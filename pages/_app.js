import '../styles/globals.css'
import { useEffect } from 'react'

export default function App({ Component, pageProps }) {
  useEffect(() => {
    // Apply saved theme on load
    const saved = localStorage.getItem('tz_dark_mode')
    if (saved === 'dark') document.documentElement.setAttribute('data-theme','dark')
    else document.documentElement.removeAttribute('data-theme')
  }, [])
  return <Component {...pageProps} />
}
