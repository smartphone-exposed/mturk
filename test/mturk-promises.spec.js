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
})

beforeEach(() => {
  mturk = new AWS.MTurk({
    endpoint: endpoint
  })
})

describe('Test Wrapper', async () => {
  test('modifies functions', async () => {
    const unexpected = mturk.listHITs.toString()
    mturkPromises(mturk)
    expect(mturk.listHITs.toString()).not.toEqual(unexpected)
  })

  test('test promise', async () => {
    mturkPromises(mturk)
    const data = await mturk.listHITs()
    expect(data).toHaveProperty('HITs')
    expect(data.HITs.length).toBeGreaterThan(0)

    // full coverage!
    // listAssignmentsForHIT requires a HITId which we don't specify
    expect(mturk.listAssignmentsForHIT()).rejects.toBeTruthy()
  })
})
