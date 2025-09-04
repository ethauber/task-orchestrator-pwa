import { describe, it, expect } from 'vitest'
import { POST } from '@/app/api/llm/route'

describe('LLM API', () => {
  it('400 without messages', async () => {
    const req = new Request('http://test/llm', { method:'POST', body: JSON.stringify({}) })
    const res = await POST(req as any)
    expect(res.status).toBe(400)
  })
})


