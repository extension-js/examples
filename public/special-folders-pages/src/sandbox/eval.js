// This page is listed under manifest "sandbox.pages", so it runs under the
// sandbox CSP where eval() is allowed. Regular extension pages cannot do this.
eval(
  "document.getElementById('message').innerHTML = '<p>I am the " +
    "output of an eval-ed script running inside the sandbox.</p>'"
)
