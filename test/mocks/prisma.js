'use strict'

const createModelMock = () => ({
  findUnique:   jest.fn(),
  findMany:     jest.fn(),
  create:       jest.fn(),
  update:       jest.fn(),
  upsert:       jest.fn(),
  delete:       jest.fn(),
  count:        jest.fn(),
  groupBy:      jest.fn(),
  deleteMany:   jest.fn(),
})

const prismaMock = {
  user:         createModelMock(),
  userProfile:  createModelMock(),
  cvUpload:     createModelMock(),
  jobPosting:   createModelMock(),
  matchResult:  createModelMock(),
  skill:        createModelMock(),
  industry:     createModelMock(),
  company:      createModelMock(),
  jobSkill:     createModelMock(),
  jobIndustry:  createModelMock(),
  $connect:     jest.fn(),
  $disconnect:  jest.fn(),
}

export default prismaMock