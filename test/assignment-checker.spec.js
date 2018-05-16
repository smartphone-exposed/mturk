const fs = require('fs')
const path = require('path')
const yaml = require('js-yaml')
const AWS = require('aws-sdk')
const mturkPromises = require('../mturk-promises')
const AssignmentChecker = require('../assignment-checker')

var mturk
var config
beforeAll(() => {
  AWS.config.setPromisesDependency(null)
  config = yaml.safeLoad(fs.readFileSync(path.join(__dirname, '..', 'config.yaml')))
  AWS.config.update(config.aws)

  const mturkConfig = config.mturk
  const mturkEndpoint = mturkConfig.use_sandbox ? mturkConfig.sandbox_endpoint : mturkConfig.endpoint
  mturk = new AWS.MTurk({
    endpoint: mturkEndpoint
  })
  mturkPromises(mturk)
})

describe.only('AssignmentChecker', async () => {
  test('mongo connect', async () => {
    const checker = new AssignmentChecker(mturk, config)
    await checker.setupMongoClient()
    // Attempt to run a query
    const db = checker.db
    const collection = await db.collection('results')
    const result = await collection.findOne({type: 'expt-data'})
    expect(result).toHaveProperty('_id')
    expect(result).toHaveProperty('experimentID')
  })
})
