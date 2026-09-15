# Getting this online

Nothing here needs building. The steps are: create the repository, push these
files, turn on Pages.

## 1. Create the repository

On github.com, inside the **parametrix-digitalservices** organisation, create a
new repository. Suggested name: `visualization-services`.

- Public is simplest — GitHub Pages on a private repository needs a paid plan.
- Do not add a README, .gitignore or licence; this folder already has what it
  needs, and an extra file will make the first push conflict.

## 2. Push this folder

From a terminal in this folder:

```bash
git init -b main
git add .
git commit -m "Parametrix Visualization Services site"
git remote add origin https://github.com/parametrix-digitalservices/visualization-services.git
git push -u origin main
```

If you would rather not use the command line, GitHub Desktop works: **File →
Add local repository**, point it at this folder, then **Publish repository** and
choose the parametrix-digitalservices organisation.

## 3. Turn on Pages

In the repository: **Settings → Pages → Build and deployment**.
Set **Source** to *Deploy from a branch*, branch `main`, folder `/ (root)`, Save.

The site appears at:

```
https://parametrix-digitalservices.github.io/visualization-services/
```

## 4. Afterwards

- The QR codes on the two sell sheets currently point at the Claude artifact
  versions of these pages. Once the GitHub Pages URL is live, those QR codes
  should be regenerated against it.
- To use a parametrix.com address instead, add a `CNAME` file containing the
  hostname and point a DNS CNAME record at
  `parametrix-digitalservices.github.io`. That needs whoever runs Parametrix DNS.
