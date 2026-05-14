'use strict'

const storageMock = {
  from: jest.fn().mockReturnThis(),
  upload:       jest.fn(),
  remove:       jest.fn(),
  download:     jest.fn(),
  getPublicUrl: jest.fn(),
}

// from() harus mengembalikan objek yang punya semua method storage
storageMock.from.mockImplementation(() => storageMock)

const supabaseMock = {
  storage: storageMock,
}

export default supabaseMock
