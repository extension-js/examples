# Store metadata

Starter file generated from this template's manifest. Every store asks
for this material at submission time; keep it current as the code
changes instead of rewriting it at the end. Replace the placeholder
lines marked TODO before you submit.

Packaging your extension is local and free. Submitting the result to a
store is what [extension.dev](https://docs.extension.dev/publish/overview?utm_source=store-md)
does, and it sponsors Extension.js.

Last updated: 2026-09-24

## Listing

- Name: YOLO Object Detection New Tab Example
- Summary: Replaces your new tab page with a page that detects objects in an image, a video, or the camera.
- Description: TODO write two or three short paragraphs of user
  benefits. Describe what the user sees and gains, not how the code
  works.
- Category: TODO pick one per store (for example Productivity).
- Screenshots: TODO at least one 1280x800 screenshot per store.

## Privacy and data use

- Images, video frames, and camera frames are processed on the device.
  This template does not upload them or any other user data.
- The manifest declares data_collection_permissions: none for
  Firefox, which matches this behavior. If you add data collection,
  update the declaration, this section, and your privacy policy in
  the same change.
- The camera button asks the browser for camera access. That prompt
  is not a manifest permission.
- Privacy policy URL: TODO required by every store once you collect
  any data.

## Chrome Web Store

### Single purpose

Replaces your new tab page with a page that detects objects in an image, a video, or the camera.

### Permissions justification

- `sidePanel` (Chrome): the toolbar button opens the side panel so the
  last detection stays on screen while the user browses other tabs.
  Firefox opens the same page through `sidebar_action` and does not
  use this permission.
- `storage` (Chrome and Firefox): the new tab saves the last detection
  on the device. The panel reads that saved list when it opens, including
  after the run has already finished. Nothing is uploaded.

## Firefox Add-ons

### Reviewer notes

TODO steps a reviewer needs to exercise the extension, plus test
credentials if sign-in is required. The build is bundled, so AMO
requires a source zip; include build-from-source instructions:
npm install, then npm run build. The dist output matches the upload.

Open a new tab, wait until the status says the model loaded, then
open the sample image. Boxes are drawn on the photo. Camera and
video stay on the device.

Click the toolbar button to open the side panel. It lists the objects
from the last run. Open that panel after the run has finished and the
same list is still there. Nothing leaves the device.

### Release notes

TODO user-facing notes for the version you are submitting.

## Edge Add-ons

### Certification notes

TODO anything the certification team needs to test the extension,
including test steps and credentials. Mirrors the Firefox reviewer
notes in most cases.

## Version history

- 1.0.0 (unreleased): initial version from the newtab-react-onnxruntime
  template. Not yet submitted to any store.
