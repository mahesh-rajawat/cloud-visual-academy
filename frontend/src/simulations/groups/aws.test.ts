import { describe, expect, it } from 'vitest'
import { awsOwner, groups, iamDecision, purchaseCost, transferCharged, vpcReachable } from './aws'

const sc = (g: string, s: string) => groups.find((x) => x.id === g)!.scenarios.find((x) => x.id === s)!
const allowAll = { igwAttached: true, routeToIgw: true, publicIp: true, naclInboundAllowsPort: true, naclOutboundAllowsEphemeral: true, sgInboundAllowsPort: true }

describe('CLF-C02 models', () => {
  it('VPC reachability needs IGW, route, public IP, NACL both ways and SG', () => {
    expect(vpcReachable(allowAll).every(([ok]) => ok)).toBe(true)
    expect(vpcReachable({ ...allowAll, routeToIgw: false })[1]![0]).toBe(false)
    expect(vpcReachable({ ...allowAll, naclOutboundAllowsEphemeral: false })[3]![1]).toMatch(/stateless/)
    expect(vpcReachable({ ...allowAll, sgInboundAllowsPort: false })[4]![0]).toBe(false)
  })
  it('IAM: SCP limits, explicit deny wins, implicit deny by default', () => {
    const base = { scpAllows: true, explicitDeny: false, identityAllow: true, resourceAllow: false, isRoot: false, inOrgMember: true }
    expect(iamDecision(base).allowed).toBe(true)
    expect(iamDecision({ ...base, explicitDeny: true }).allowed).toBe(false)
    expect(iamDecision({ ...base, identityAllow: false }).allowed).toBe(false)
    expect(iamDecision({ ...base, scpAllows: false, isRoot: true }).allowed).toBe(false)
  })
  it('shared responsibility shifts with the service', () => {
    expect(awsOwner('Amazon EC2', 'Patching the guest operating system')).toBe('Customer')
    expect(awsOwner('Amazon RDS', 'Patching the database engine')).toBe('AWS')
    expect(awsOwner('AWS Lambda', 'Patching the guest operating system')).toBe('AWS')
    expect(awsOwner('Amazon S3', 'Encrypting and classifying customer data')).toBe('Customer')
  })
  it('data transfer rules', () => {
    expect(transferCharged('Internet → AWS (inbound)').charged).toBe(false)
    expect(transferCharged('Between AZs in the same Region').charged).toBe(true)
    expect(transferCharged('Same AZ using private IPs').charged).toBe(false)
  })
  it('commitments cost the same even when unused; Spot is cheapest', () => {
    expect(purchaseCost('Savings Plan / Reserved (1 yr)', 100, false).cost).toBe(purchaseCost('Savings Plan / Reserved (1 yr)', 700, false).cost)
    expect(purchaseCost('Spot', 300, true).cost).toBeLessThan(purchaseCost('On-Demand', 300, true).cost)
  })
  it('scenario: VPC default is blocked by the missing route, multi-AZ survives AZ loss', () => {
    expect(sc('aws-tech-sim', 'aws-vpc').evaluate(sc('aws-tech-sim', 'aws-vpc').initial).outcome.ok).toBe(false)
    expect(sc('aws-tech-sim', 'aws-ha').evaluate(sc('aws-tech-sim', 'aws-ha').initial).outcome.ok).toBe(true)
  })
})
