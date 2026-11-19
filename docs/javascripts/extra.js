// The site is light-only, except the home page hero, which sits on a dark image.
// Lesson figures (<figure data-figure>) are mounted from figures/index.js.
const figuresUrl = new URL('figures/index.js', document.currentScript.src).href

document$.subscribe(function () {
  const home = !!document.querySelector('.hero-section')
  document.body.setAttribute('data-md-color-scheme', home ? 'slate' : 'default')
  document.body.classList.toggle('home-page', home)
  import(figuresUrl).then((m) => m.scan())
})
