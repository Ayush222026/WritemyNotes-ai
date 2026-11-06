# WriteMyNotes AI ✍️

**Turn Your Text Into Beautiful Handwritten Notes.**

WriteMyNotes AI converts typed text into handwriting-style notebook pages and lets you download them as a PDF. Everything runs in your browser. There is no server, no login and no paid API.

> This tool creates handwriting-style digital text. It does not reproduce real human handwriting. Please follow your school or college rules about assignments.

## Features

- **Text input:** type, paste or upload a `.txt` file, live word and character count, clear all, sample assignment
- **Auto formatting:** headings, subheadings, paragraphs, numbered lists, bullet points, line breaks (your wording is never changed)
- **10 paper templates** with thumbnails: A4 Ruled, A4 Plain, A4 Spiral Notebook, A5 Ruled, A5 Plain, Letter, Indian School Notebook, Single Line, Double Line, Custom
- **Paper customization:** page size (A4, A5, Letter, custom mm), paper colour, line style and colour, red margin line, top/left/right margins, line spacing, spiral binding
- **Pen settings:** Blue, Dark Blue, Black, Red, Green, Purple, Multicolour, custom colour, separate heading colour, ink thickness, ink opacity, pen texture (ballpoint, gel, fountain, pencil), slight handwriting imperfections
- **10 handwriting fonts** with previews: Caveat, Kalam, Patrick Hand, Comic Neue, Handlee, Architects Daughter, Shadows Into Light, Indie Flower, Homemade Apple, Schoolbell
- **English and Hindi** support (Kalam is used for Hindi characters)
- **Multicolour notes mode:** blue headings, purple subheadings, green definitions, red warnings, black normal text (all colours editable)
- **Canvas handwriting engine:** small variation in position and rotation, natural line alignment, ink texture, automatic word wrap and page breaks
- **Cover page:** 5 templates, student name, roll number, class, section, subject, title, teacher, school/college, date (on/off switch)
- **Live preview:** all pages, previous/next, page jump, zoom, quick pen/paper/font change
- **PDF tools:** Download PDF, Preview PDF, Print, quality choice, loading bar with cancel
- **Projects:** auto-save, rename, duplicate, delete, export and import (.json), reset settings, recent assignments
- **Light and dark mode**, mobile-first layout (bottom navigation on phones, sidebar on desktop)

## Tech stack

HTML5, CSS3, vanilla JavaScript, HTML Canvas, Google Fonts, [jsPDF](https://github.com/parallax/jsPDF) (loaded from cdnjs), GitHub Pages for hosting.

## Folder structure

```
writemynotes-ai/
├── index.html      Page structure
├── style.css       Base design, dark mode, navigation
├── script.js       Navigation, theme, notifications
├── editor.css / editor.js     Text editor and auto formatting
├── engine.css / engine.js     Canvas handwriting engine
├── paper.css / paper.js       Paper templates and settings
├── pen.css / pen.js           Pen colours, fonts, ink settings
├── preview.css / preview.js   Live preview
├── cover.css / cover.js       Cover page
├── pdf.css / pdf.js           PDF download, preview, print
├── projects.css / projects.js Projects, backup, reset
└── README.md
```

## How to use

1. Open the website
2. Paste or type your text (Write tab)
3. Choose a paper (Paper tab)
4. Choose a pen colour (Styles tab)
5. Choose a handwriting font (Styles tab)
6. Adjust font size and spacing
7. Turn on the cover page if you need one
8. Check every page in Live Preview
9. Press **Download PDF**

### Formatting rules

| You write | Result |
| --- | --- |
| `# Title` | Heading |
| `## Title` | Subheading |
| `1. text` | Numbered list |
| `- text` or `* text` | Bullet point |
| Short ALL CAPS line | Heading |
| Short line ending with `:` | Subheading |
| Empty line | Paragraph gap |
| `Definition: ...` (Multicolour pen) | Green text |
| `Warning: ...` (Multicolour pen) | Red text |

## Deploy on GitHub Pages (free)

### 1. Create a repository
1. Go to [github.com](https://github.com) and sign in (or sign up).
2. Tap **+** (top right) → **New repository**.
3. Repository name: `writemynotes-ai`. Choose **Public**. Tick **Add a README file**.
4. Tap **Create repository**.

### 2. Upload the project files
1. Open your repository.
2. Tap **Add file** → **Upload files** (or **Create new file** and paste code one by one).
3. Select all project files (`index.html`, all `.css` and `.js` files, `README.md`).
4. Tap **Commit changes**.

Keep every file in the main folder (not inside another folder). File names are case-sensitive.

### 3. Turn on GitHub Pages
1. Open **Settings** → **Pages** (left menu).
2. Under **Build and deployment**, set **Source** to `Deploy from a branch`.
3. Set **Branch** to `main` and folder to `/ (root)`. Tap **Save**.

### 4. Open the live website
Wait 1 to 2 minutes and refresh the Pages settings page. You will see your link:

```
https://YOUR-USERNAME.github.io/writemynotes-ai/
```

### 5. Update the website later
1. Open the file in your repository and tap the ✏️ pencil icon.
2. Make your change and tap **Commit changes**.
3. Wait 1 to 2 minutes. If you still see the old version, open the link with `?v=2` at the end (for example `.../writemynotes-ai/?v=2`).

## Backup your work

Projects are saved only in your browser (localStorage). Clearing browser data deletes them. Open the **Projects** tab and press **Export** on important assignments to keep a `.json` backup. Use **Import** to bring them back.

## Known limitations

- PDF pages are images, so text inside the PDF cannot be selected or copied. Fonts and Hindi look exactly like the preview.
- Internet is needed for Google Fonts and for the PDF library (cdnjs). Preview and Print work without the PDF library.
- Hindi uses the Kalam font. Slight letter tilt is turned off for Hindi so the top line (shirorekha) stays joined. Some complex conjuncts may look slightly different from printed text.
- Very large documents on low-memory phones may be slow. Above 30 pages the PDF quality is lowered automatically.
- Projects live in one browser on one device (about 5 MB limit). If the same site is open in two tabs, the last change wins.
- Print margins can differ slightly between browsers.
- Only plain text is supported (no images, tables or maths symbols layout).
- This is handwriting-style text, not real human handwriting.

## Troubleshooting

| Problem | What to do |
| --- | --- |
| Blank page | Check that all file names match exactly (lowercase) and are in the main folder |
| Old version after update | Wait 2 minutes, then open the link with `?v=2` at the end |
| Fonts look plain | Check your internet and refresh once |
| PDF does not download | Check your internet, set quality to Standard and try again |
| Projects missing | Browser data may have been cleared. Import your exported `.json` file |

## Credits

Fonts by Google Fonts (SIL Open Font License). PDF generation by jsPDF (MIT License).
