import type { ReactNode } from 'react'

/**
 * Lesson text is plain strings. This finds the code inside a sentence (CLI commands, cmdlets,
 * template functions, decorators, property names, file names, flags) and renders it as inline code,
 * so commands stand out from the explanation around them. `Backticks` also mark code explicitly.
 */
const AZ_VERB = '(?:create|update|delete|show|list|start|stop|deallocate|restart|resize|redeploy|build|decompile|export|register|attach|detach|enable|disable|set|add|remove|move|swap|upload|download|assign|login|invoke|run-command|test-ip-flow|what-if|generate-sas|check|query|copy|sync|validate|mount|install|purge|recover|import|failover)(?:-[a-z]+)*\\b'
const PATTERNS = [
  /`[^`\n]+`/.source, // explicit `code`
  // az <group words> <verb> [--flags values]
  `\\baz(?: [a-z][a-z0-9-]*){0,3} ${AZ_VERB}(?: (?:--?[a-z][a-z0-9-]*)(?:[ =](?![a-z]+\\b(?: |$)(?!-))[^\\s,;()]+|[ =](?:true|false|All|Premium_LRS|Standard_LRS))?)*`,
  /\b(?:Get|Set|New|Remove|Update|Start|Stop|Add|Register|Invoke|Test|Restart|Connect|Export|Import|Enable|Disable|Move|Backup|Restore)-(?:Az|Mg)[A-Za-z]+\b/.source,
  /\[[a-z][A-Za-z]*\([^\]\n]*\]/.source, // ARM expression [resourceGroup().location]
  /\bMicrosoft\.[A-Za-z]+(?:\/[A-Za-z]+)+(?:@[\d-]+(?:-preview)?)?/.source,
  /'[^'\s]*@[^'\s]*'/.source, // 'type@apiVersion'
  /(?<![\w.@])@(?:secure|allowed|minLength|maxLength|minValue|maxValue|description|metadata|batchSize|export|sealed|discriminator)\b(?:\([^()\n]*\))?/.source, // @secure()
  /\b[a-z][A-Za-z0-9]*\((?!s\))[^()\n]{0,60}(?:\([^()\n]*\)[^()\n]{0,30})*\)(?:\.[A-Za-z][\w]*)*/.source, // uniqueString(resourceGroup().id)
  /(?<![\w$])\$[a-zA-Z_]\w*/.source, // $schema, $vm
  /(?<![\w-])--[a-z][a-z0-9-]+(?:=\S+)?/.source, // --flags
  /(?<![\w-])-(?:WhatIf|Force|Confirm|AsJob|EncryptionAtHost|ResourceGroupName|TemplateFile|Mode)\b/.source,
  /(?<![\w-])-(?:eq|ne|startsWith|notStartsWith|contains|notContains|match|notMatch|in|notIn|and|or|not|any|all)\b/.source, // dynamic group rule operators
  /\b(?:user|device)\.(?:<[a-z]+>|[a-zA-Z]+)/.source, // user.department, user.<property>
  /(?<![\w/])[\w-]*\.(?:bicepparam|bicep|parameters\.json|ps1|kql)\b/.source,
  /\b[a-z][a-z0-9]*(?:[A-Z][a-z0-9]+)+(?:\.[a-z][A-Za-z0-9]*)*\b/.source, // camelCase (dependsOn, securityProfile.encryptionAtHost)
  /\b[a-z][a-z0-9]*\.(?:id|name|properties|location)\b/.source, // vnet.id
  /\b(?:\*\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:core\.windows\.net|azurewebsites\.net|azurecr\.io|database\.windows\.net)\b/.source,
]
const CODE_RE = new RegExp(PATTERNS.join('|'), 'g')

export function splitCode(text: string): Array<{ code: boolean; text: string }> {
  const parts: Array<{ code: boolean; text: string }> = []
  let last = 0
  for (const m of text.matchAll(CODE_RE)) {
    const start = m.index ?? 0
    let value = m[0]
    // Trailing sentence punctuation belongs to the sentence, not the code.
    const trimmed = value.replace(/[.,:;]+$/, '')
    if (start > last) parts.push({ code: false, text: text.slice(last, start) })
    parts.push({ code: true, text: trimmed.startsWith('`') ? trimmed.slice(1, -1) : trimmed })
    value = trimmed
    last = start + value.length
  }
  if (last < text.length) parts.push({ code: false, text: text.slice(last) })
  return parts
}

export function Rich({ text }: { text: string }): ReactNode {
  return splitCode(text).map((p, i) => p.code
    ? <code key={i} className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.88em] text-slate-800 dark:bg-slate-800 dark:text-slate-100">{p.text}</code>
    : <span key={i}>{p.text}</span>)
}

/** "Topic: rest" at the start of a paragraph or after a full stop. Short, without brackets or full stops. */
const LEAD_RE = /(^|\. )([A-Z](?:[^:.()\n]|\([^:()\n]*\)){1,70}): (?=\S)/g

/** Splits on "; " outside brackets, so lists inside parentheses stay together. */
export function splitList(text: string): string[] {
  const parts: string[] = []
  let depth = 0
  let start = 0
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (c === '(' || c === '[' || c === '{') depth++
    else if ((c === ')' || c === ']' || c === '}') && depth > 0) depth--
    else if (c === ';' && text[i + 1] === ' ' && depth === 0) {
      parts.push(text.slice(start, i).trim())
      start = i + 2
    }
  }
  parts.push(text.slice(start).trim())
  return parts.filter(Boolean)
}

/** Inline text where topic names before a colon are bold and code is formatted. */
export function WithLeads({ text }: { text: string }): ReactNode {
  const out: ReactNode[] = []
  let last = 0
  for (const m of text.matchAll(LEAD_RE)) {
    const start = (m.index ?? 0) + m[1]!.length
    if (start > last) out.push(<Rich key={`t${last}`} text={text.slice(last, start)} />)
    out.push(<strong key={`b${start}`} className="font-semibold text-slate-900 dark:text-slate-50">{m[2]}:</strong>, ' ')
    last = start + m[2]!.length + 2
  }
  if (last < text.length) out.push(<Rich key={`t${last}`} text={text.slice(last)} />)
  return out
}

/**
 * A lesson paragraph made easier to scan: the topic it starts with ("Creating users:") is bold, later
 * topics after a full stop are bold too, and a long list separated by semicolons becomes bullet points.
 */
export function RichParagraph({ text }: { text: string }): ReactNode {
  const lead = text.match(/^([A-Z](?:[^:.()\n]|\([^:()\n]*\)){1,70}): (?=\S)/)
  const body = lead ? text.slice(lead[0].length) : text
  const items = splitList(body)
  if (lead && items.length >= 3) {
    return (
      <div className="mb-3">
        <p className="mb-1"><strong className="font-semibold text-slate-900 dark:text-slate-50">{lead[1]}</strong></p>
        <ul className="ml-5 list-disc space-y-1">{items.map((it) => <li key={it}><WithLeads text={it} /></li>)}</ul>
      </div>
    )
  }
  return <p><WithLeads text={text} /></p>
}
