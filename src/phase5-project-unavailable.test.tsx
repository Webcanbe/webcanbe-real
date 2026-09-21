import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, expect, it, vi } from 'vitest'
import App from './App'

afterEach(() => vi.unstubAllGlobals())
it.each(['/project/not-a-real-project', '/project/not-a-real-project/preview'])(
  'does not replace an unknown address with a default project: %s', pathname => {
    vi.stubGlobal('window', {location:{pathname,search:'',origin:'http://localhost:4180',hostname:'localhost'}})
    const html = renderToStaticMarkup(<App />)
    expect(html).toContain('unavailable')
    expect(html).toContain('Back to marketplace')
    expect(html).not.toContain('Northstar')
    expect(html).not.toContain('Buy project')
    expect(html).not.toContain('Public preview')
  },
)
