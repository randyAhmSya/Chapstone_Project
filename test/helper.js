'use strict'

const jwt = require('jsonwebtoken')

// Environment defaults
process.env.JWT_SECRET     = process.env.JWT_SECRET     || 'test-secret-minimum-32-characters-ok'
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'
process.env.NODE_ENV       = 'test'

// Token helper


// Buat JWT yang valid untuk user tertentu

const makeToken = (userId = 'user-abc-123') =>
  `Bearer ${jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '1h' })}`

// Fake entity factories

const fakeUser = (overrides = {}) => ({
  id:           'user-abc-123',
  email:        'test@example.com',
  name:         'Test User',
  passwordHash: '$2a$12$fakehashfakehashfakehashfakehashfakehashfakeha',
  createdAt:    new Date('2024-01-01'),
  updatedAt:    new Date('2024-01-01'),
  ...overrides,
})

const fakeProfile = (overrides = {}) => ({
  id:          'profile-abc-123',
  userId:      'user-abc-123',
  headline:    null,
  location:    null,
  careerPrefs: null,
  ...overrides,
})

const fakeCV = (overrides = {}) => ({
  id:            'cv-abc-123',
  userId:        'user-abc-123',
  fileName:      'cv_saya.pdf',
  fileUrl:       'https://storage.example.com/cv-uploads/user-abc-123/123_cv_saya.pdf',
  storagePath:   'user-abc-123/123_cv_saya.pdf',
  extractedText: 'Saya adalah software engineer dengan pengalaman React Node.js PostgreSQL Docker Git ' +
                 'python machine learning tensorflow keras scikit-learn pandas numpy komunikasi tim',
  uploadedAt:    new Date('2024-01-01'),
  ...overrides,
})

const fakeSkill = (overrides = {}) => ({
  skillId:   'react',
  skillName: 'React',
  ...overrides,
})

const fakeJobPosting = (overrides = {}) => ({
  id:                       1,
  title:                    'Frontend Developer',
  jobDescription:           'We need a React developer with Node.js experience',
  skillsDesc:               'React, Node.js, PostgreSQL',
  location:                 'Jakarta',
  remoteAllowed:            1,
  formattedWorkType:        'Full-time',
  formattedExperienceLevel: 'Mid-Senior level',
  applies:                  100,
  listedTime:               Date.now(),
  sponsored:                false,
  company: {
    id:          1,
    companyName: 'PT Teknologi Maju',
    city:        'Jakarta',
    country:     'Indonesia',
    companySize: '50-200',
  },
  skills: [
    { skill: { skillId: 'react',    skillName: 'React'     } },
    { skill: { skillId: 'nodejs',   skillName: 'Node.js'   } },
    { skill: { skillId: 'postgres', skillName: 'PostgreSQL' } },
  ],
  salaries:   [],
  benefits:   [],
  industries: [],
  ...overrides,
})

const fakeMatchResult = (overrides = {}) => ({
  id:           'match-abc-123',
  userId:       'user-abc-123',
  cvUploadId:   'cv-abc-123',
  jobPostingId: 1,
  matchScore:   0.67,
  skillGapJson: {
    note:     'Analisis fallback',
    present:  ['react', 'nodejs'],
    missing:  ['postgres'],
    required: ['react', 'nodejs', 'postgres'],
  },
  createdAt:  new Date('2024-01-01'),
  jobPosting: fakeJobPosting(),
  cvUpload:   { id: 'cv-abc-123', fileName: 'cv_saya.pdf' },
  ...overrides,
})

// Express mock res/req builders

// Buat mock untuk Express req
const mockReq = (overrides = {}) => ({
  body:    {},
  params:  {},
  query:   {},
  headers: {},
  user:    fakeUser(),
  file:    null,
  ip:      '127.0.0.1',
  socket:  { remoteAddress: '127.0.0.1' },
  ...overrides,
})


// Buat mock untuk Express res dengan spy lengkap

const mockRes = () => {
  const res = {}
  res.status = jest.fn().mockReturnValue(res)
  res.json   = jest.fn().mockReturnValue(res)
  res.send   = jest.fn().mockReturnValue(res)
  return res
}


//Buat mock untuk Express next()
 
const mockNext = () => jest.fn()

module.exports = {
  makeToken,
  fakeUser,
  fakeProfile,
  fakeCV,
  fakeSkill,
  fakeJobPosting,
  fakeMatchResult,
  mockReq,
  mockRes,
  mockNext,
}