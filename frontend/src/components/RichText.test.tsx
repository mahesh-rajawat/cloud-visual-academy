import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RichParagraph, splitCode, splitList } from './RichText'

const codes = (t: string) => splitCode(t).filter((p) => p.code).map((p) => p.text)

describe('splitCode', () => {
  it('marks template syntax from the ARM/Bicep lesson as code', () => {
    const t = 'ARM JSON sections: $schema, contentVersion, parameters (type, defaultValue, allowedValues, minValue/maxValue). Template functions include resourceId(), reference(), concat()/format(), uniqueString(), resourceGroup().location.'
    expect(codes(t)).toEqual(['$schema', 'contentVersion', 'defaultValue', 'allowedValues', 'minValue', 'maxValue', 'resourceId()', 'reference()', 'concat()', 'format()', 'uniqueString()', 'resourceGroup().location'])
  })
  it('marks Bicep decorators, symbolic references and files', () => {
    expect(codes("Bicep: param (with decorators such as @secure(), @allowed()). Referencing vnet.id creates an implicit dependency; use a .bicepparam file or main.bicep.")).toEqual(['@secure()', '@allowed()', 'vnet.id', '.bicepparam', 'main.bicep'])
    expect(codes("resource symbolicName 'type@apiVersion' = {…}")).toEqual(['symbolicName', "'type@apiVersion'"])
  })
  it('marks whole CLI commands and stops before the prose', () => {
    expect(codes('az bicep build compiles to JSON; az bicep decompile converts JSON to Bicep.')).toEqual(['az bicep build', 'az bicep decompile'])
    expect(codes('Scopes: resource group (az deployment group create), subscription (az deployment sub create, for example resource groups).')).toEqual(['az deployment group create', 'az deployment sub create'])
    expect(codes('Run az vm deallocate -g rg-app -n vm1 first.')).toEqual(['az vm deallocate -g rg-app -n vm1'])
    expect(codes('Use az keyvault update --enabled-for-disk-encryption true; then retry.')).toEqual(['az keyvault update --enabled-for-disk-encryption true'])
  })
  it('marks PowerShell cmdlets and ARM expressions', () => {
    expect(codes('PowerShell: New-AzResourceGroupDeployment -WhatIf, location [resourceGroup().location].')).toEqual(['New-AzResourceGroupDeployment', '-WhatIf', '[resourceGroup().location]'])
  })
  it('leaves plain sentences alone', () => {
    for (const t of [
      'A user is an identity. Usage location is needed before you can give someone a licence directly.',
      'Availability set: 99.95%, up to 3 fault / 20 update domains (e.g. racks), chosen at VM creation.',
      'Costs US$0.01 per hour. The disk(s) stay billed until deleted.',
      'Email the team at admin@contoso.com when CPU is above 80%.',
      'Microsoft Entra ID (formerly Azure AD) holds users; the az CLI and PowerShell both work.',
    ]) expect(codes(t), t).toEqual([])
  })
  it('honours explicit backticks', () => {
    expect(codes('Set `HTTPS Only` to On.')).toEqual(['HTTPS Only'])
  })
})

describe('splitCode edge cases from the lessons', () => {
  it('does not swallow the next word after a command', () => {
    expect(codes('az vm list-vm-resize-options shows the sizes you can pick.')).toEqual(['az vm list-vm-resize-options'])
  })
  it('keeps parameter file names whole', () => {
    expect(codes('Pass --parameters @prod.parameters.json to the command.')).toEqual(['--parameters', 'prod.parameters.json'])
  })
})

describe('scannable paragraphs', () => {
  it('splits a semicolon list only outside brackets', () => {
    expect(splitList('a (x; y); b; c')).toEqual(['a (x; y)', 'b', 'c'])
    expect(splitList('no list here')).toEqual(['no list here'])
  })
  it('bolds the topic a paragraph starts with, and later topics after a full stop', () => {
    render(<RichParagraph text="Group types: Security and Microsoft 365. Membership types: Assigned or Dynamic." />)
    expect(screen.getByText('Group types:').tagName).toBe('STRONG')
    expect(screen.getByText('Membership types:').tagName).toBe('STRONG')
  })
  it('turns a long semicolon list after a topic into bullets', () => {
    render(<RichParagraph text="Roles: User Administrator manages users; Groups Administrator manages groups; owners manage membership." />)
    expect(screen.getByText('Roles').tagName).toBe('STRONG')
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
  })
  it('leaves sentences without a topic as plain paragraphs', () => {
    const { container } = render(<RichParagraph text="Deleted users can be restored for 30 days." />)
    expect(container.querySelector('strong')).toBeNull()
    expect(container.querySelector('ul')).toBeNull()
  })
})

describe('dynamic membership rule syntax', () => {
  it('formats rule properties and operators as code, but not hyphenated words', () => {
    expect(codes('Rules use user.<property> -eq / -ne / -startsWith, combined with -and / -or.')).toEqual(['user.<property>', '-eq', '-ne', '-startsWith', '-and', '-or'])
    expect(codes('A lift-and-shift move or a pay-as-you-go plan.')).toEqual([])
  })
})
