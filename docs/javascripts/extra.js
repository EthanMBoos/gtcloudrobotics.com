document$.subscribe(function () {
  if (document.querySelector('.hero-section')) {
    document.body.setAttribute('data-md-color-scheme', 'slate')
    document.body.classList.add('home-page')
  } else {
    const stored = __md_get('__palette')
    const scheme = stored?.color?.scheme ?? 'default'
    document.body.setAttribute('data-md-color-scheme', scheme)
    document.body.classList.remove('home-page')
  }
})
