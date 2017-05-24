const fs = require("fs")
const path = require("path")
const glob = require("glob-promise")
const { dialog } = require("electron").remote
const csv = require("./csv.js")
const sqlite3 = require("sqlite3").verbose()

let LTEB
let LTET
let nonLTET
let CES
let ETH
let guardGroup
const dbpath = "data.db"

function clearClassList(element) {
  if (element.classList) {
    while (element.classList.length > 0) {
      element.classList.remove(element.classList[0])
    }
  }
}

function createList() {
  const html = `
    <div class="header">${(LTEB && LTET) || (CES && ETH && guardGroup && nonLTET) ? "包含文件: " : "文件夹需要至少包含一种业务的信息: "}</div>
    <div class="ui list">
      <div class="item">
        <div class="ui ${(LTEB && LTET) ? "teal" : "red"} label">
        LTE业务
        <span id="lte-list"><i class="ui ${(LTEB && LTET) ? "check" : "remove"} circle icon"></i></span>
        </div>
      </div>
      <div class="item">
        <div class="ui ${(CES && ETH && guardGroup && nonLTET) ? "teal" : "red"} label">
        非LTE业务
        <span id="lte-list"><i class="ui ${(CES && ETH && guardGroup && nonLTET) ? "check" : "remove"} circle icon"></i></span>
        </div>
      </div>
    </div>
  `
  return html
}

function hideMessage() {
  document.getElementById("message").classList.add("hidden")
}
function showMessage(msg, className) {
  const element = document.getElementById("message")
  element.innerHTML = msg
  clearClassList(element)
  element.classList.add("ui", className, "message")
}

function toggleDivPathError(value) {
  switch (value) {
  case "on":
  case "error":
    document.getElementById("div-path").classList.add("error")
    break
  case "off":
  case "onerror":
    document.getElementById("div-path").classList.remove("error")
  }
}
function changeIcon(iconClass) {
  const classList = ["ui", ...iconClass, "icon"]
  const element = document.getElementById("icon-path")
  clearClassList(element)
  element.classList.add(...classList)
}
function toggleBtn(...args) {
  const element = document.getElementById(args[0])
  if (args.length > 1) {
    switch (args[1]) {
    case "enable":
      if (element.classList.contains("disabled")) {
        element.classList.remove("disabled")
      }
      break
    case "disable":
    default:
      if (!element.classList.contains("disabled")) {
        element.classList.add("disabled")
      }
      break
    }
  } else {
    element.classList.toggle("disabled")
  }
}

async function checkFolder(folder) {
  // LTE业务表1.xls, 光缆链接关系.xls
  const files = await glob(`${folder}/**/*.csv`)
  LTEB = ""
  LTET = ""
  nonLTET = ""
  CES = ""
  ETH = ""
  guardGroup = ""
  files.forEach((file) => {
    const basename = path.basename(file)
    console.log(basename)
    switch (basename) {
    case "LTE业务信息表.csv":
      LTEB = file
      break
    case "LTE业务Tunnel信息表.csv":
      LTET = file
      break
    case "非LTE业务CES.csv":
      CES = file
      break
    case "非LTE业务ETH.csv":
      ETH = file
      break
    case "非LTE业务Tunnel保护组.csv":
      guardGroup = file
      break
    case "非LTE业务Tunnel信息表.csv":
      nonLTET = file
      break
    default:
      break
    }
  })
  if ((LTEB && LTET) || (CES && ETH && guardGroup && nonLTET)) {
    showMessage(createList(), "positive")
    changeIcon(["check", "circle", "green"])
    toggleBtn("btn-inspect", "enable")
    toggleDivPathError("off")
  } else {
    showMessage(createList(), "error")
    toggleBtn("btn-inspect", "disable")
    changeIcon(["remove", "circle", "red"])
    toggleDivPathError("on")
  }
}
function checkPath(str) {
  if (!str) {
    toggleBtn("btn-inspect", "disable")
    changeIcon(["info", "circle"])
    toggleDivPathError("off")
    hideMessage()
    return
  }
  fs.stat(str, (err, stats) => {
    if (!err && stats.isDirectory()) {
      checkFolder(str)
    } else {
      toggleBtn("btn-inspect", "disable")
      changeIcon(["remove", "circle", "red"])
      showMessage("输入的文件夹不存在", "error")
      toggleDivPathError("on")
    }
  })
}

async function inspect(file) {
  const db = new sqlite3.Database(dbpath)
  await csv.createTunnelsTable(db, "lte")
  await csv.createBusinessesTable(db)
  await csv.createTunnelsTable(db, "non_lte")
  await csv.createNonLTEBusinessesTable(db)
  await csv.createNonLTETunnelsGuardGroupTable(db)
  console.log("create tables finished")
  await csv.extractTunnelsPromise(db, LTET, "lte")
  console.log("extract lte tunnels finished")
  await csv.extractTunnelsPromise(db, nonLTET, "non_lte")
  console.log("extract non-lte tunnels finished")
  await csv.extractBusinessesPromise(db, LTEB)
  console.log("extract lte business finished")
  await csv.extractNonLTEBusinessesPromise(db, CES, "ces")
  console.log("extract non-lte ces finished")
  await csv.extractNonLTEBusinessesPromise(db, ETH, "eth")
  console.log("extract non-lte eth finished")
  await csv.extractNonLTETunnelsGuardGroupPromise(db, guardGroup)
  console.log("extract non-lte tunntles guard group finished")
  await csv.close(db)
  console.log("extract finish")
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("btn-path").addEventListener("click", () => {
    const selecteds = dialog.showOpenDialog({ properties: ["openDirectory"] })
    if (selecteds) {
      document.getElementById("text-path").value = selecteds[0]
      checkPath(selecteds[0])
    }
  })
  document.getElementById("text-path").addEventListener("keyup", (event) => {
    checkPath(event.target.value)
  })
  document.getElementById("btn-inspect").addEventListener("click", (event) => {
    inspect()
  })
})
