/* eslint global: "$" */
const fs = require("fs")
const path = require("path")
const glob = require("glob-promise")
const { dialog } = require("electron").remote
const csv = require("./csv.js")

const LTE = new Set()
const nonLTE = new Set()
const fiberCable = new Set()

function clearClassList(element) {
  if (element.classList) {
    while (element.classList.length > 0) {
      element.classList.remove(element.classList[0])
    }
  }
}

function createList({ LTE, nonLTE, fiberCable }) {
  const html = `
    <div class="header">${LTE.size !== 2 && nonLTE.size !==2 ? "文件夹需要至少包含一种业务的两张表." : "包含文件:"}</div>
    <div class="ui list">
      <div class="item">
        <div class="ui teal label">
        LTE业务
        <span id="lte-list"><i class="ui ${LTE.size === 2 ? "check" : "remove"} circle icon"></i></span>
        </div>
      </div>
      <div class="item">
        <div class="ui teal label">
        非LTE业务
        <span id="lte-list"><i class="ui ${nonLTE.size === 2 ? "check" : "remove"} circle icon"></i></span>
        </div>
      </div>
      <div class="item">
        <div class="ui teal label">
        光缆链接关系
        <span id="lte-list"><i class="ui ${fiberCable.size === 1 ? "check" : "remove"} circle icon"></i></span>
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
  const files = await glob(`${folder}/**/*.xls`)
  LTE.clear()
  nonLTE.clear()
  fiberCable.clear()
  files.forEach((file) => {
    const basename = path.basename(file)
    if (basename.match(/^LTE业务表[1-2]\.xls$/i)) {
      LTE.add(file)
    } else if (basename.match(/^非LTE业务表[1-2]\.xls$/i)) {
      nonLTE.add(file)
    } else if (basename.match(/^光缆链接关系\.xls$/i)) {
      fiberCable.add(file)
    }
  })
  if (LTE.size === 2 || nonLTE.size === 2) {
    showMessage(createList({ LTE, nonLTE, fiberCable }), "positive")
    changeIcon(["check", "circle", "green"])
    toggleBtn("btn-inspect", "enable")
    toggleDivPathError("off")
  } else {
    showMessage(createList({ LTE, nonLTE, fiberCable }), "error")
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

function inspect(file) {
  csv.extractTunnels("test.db", "tunnels.csv")
}
let workbook = ""
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
