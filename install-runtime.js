// GitHub Raw installer for the public Scriptable usage widget.
// If you publish a copy elsewhere, replace RAW_BASE_URL with that repository's raw URL.

const RAW_BASE_URL = "https://raw.githubusercontent.com/MananaFX/Scritable-Codex-Usage/main/Scripts"
const FILE_MGR = FileManager[module.filename.includes("Documents/iCloud~") ? "iCloud" : "local"]()
const FILES = ["「源码」Codex用量.js"]

await Promise.all(FILES.map(async fileName => {
  const req = new Request(`${RAW_BASE_URL}/${encodeURIComponent(fileName)}`)
  const data = await req.load()
  FILE_MGR.write(FILE_MGR.joinPath(FILE_MGR.documentsDirectory(), fileName), data)
}))

FILE_MGR.remove(module.filename)
const firstScriptName = FILES[0].replace(/\.js$/i, "")
Safari.open("scriptable:///open?scriptName=" + encodeURIComponent(firstScriptName))
