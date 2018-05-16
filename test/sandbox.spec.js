const fs = require('fs')
const path = require('path')
const yaml = require('js-yaml')
const AWS = require('aws-sdk')
const mturkPromises = require('../mturk-promises')

const endpoint = 'https://mturk-requester-sandbox.us-east-1.amazonaws.com'

var mturk

beforeAll(() => {
  AWS.config.setPromisesDependency(null)
  const config = yaml.safeLoad(fs.readFileSync(path.join(__dirname, '..', '/config.yaml')))
  AWS.config.update(config)

  mturk = new AWS.MTurk({
    endpoint: endpoint
  })
  mturk = mturkPromises(mturk)
})

describe('Sandbox tests', () => {
  test('get balance', async () => {
    // Uncomment this line to use in production
    // var endpoint = 'https://mturk-requester.us-east-1.amazonaws.com';

    // This will return $10,000.00 in the MTurk Developer Sandbox
    // Docs here: http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/MTurk.html#getAccountBalance-property
    const data = await mturk.getAccountBalance()
    expect(data).toHaveProperty('AvailableBalance')
    expect(Number(data.AvailableBalance)).toEqual(10000)
  })

  test('List HITs', async () => {
    const data = await mturk.listHITs()
    expect(data).toHaveProperty('HITs')
    expect(data.HITs.length).toBeGreaterThan(0)
  })

  test('List assignments for HIT', async () => {
    const hits = await mturk.listHITs()
    const hitId = hits.HITs[0].HITId
    const data = await mturk.listAssignmentsForHIT({
      HITId: hitId,
      AssignmentStatuses: ['Submitted', 'Approved', 'Rejected']
    })
    expect(data).toHaveProperty('Assignments')
    expect(data.Assignments.length).toBeGreaterThan(0)
  })
})
