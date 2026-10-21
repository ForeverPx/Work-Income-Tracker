Unicode true
!include "MUI2.nsh"

!ifndef APP_DIR
  !error "Pass -DAPP_DIR=path/to/win-unpacked"
!endif
!ifndef OUT_FILE
  !error "Pass -DOUT_FILE=path/to/WorkPrice-Setup.exe"
!endif
!ifndef ICON_FILE
  !error "Pass -DICON_FILE=path/to/icon.ico"
!endif
!ifndef APP_VERSION
  !define APP_VERSION "1.0.0"
!endif
!ifndef VI_VERSION
  !define VI_VERSION "1.0.0.0"
!endif

Name "秒薪浮窗"
OutFile "${OUT_FILE}"
InstallDir "$LOCALAPPDATA\Programs\WorkPrice"
InstallDirRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\WorkPrice" "InstallLocation"
RequestExecutionLevel user
ShowInstDetails show
ShowUninstDetails show
SetCompressor /SOLID lzma
BrandingText "秒薪浮窗 ${APP_VERSION}"

!define MUI_ICON "${ICON_FILE}"
!define MUI_UNICON "${ICON_FILE}"
!define MUI_ABORTWARNING
!define MUI_WELCOMEPAGE_TITLE "安装秒薪浮窗"
!define MUI_WELCOMEPAGE_TEXT "秒薪浮窗会在桌面右下角显示今天的收入、下班倒计时和工作时长。$\r$\n$\r$\n设置和工作记录只保存在这台电脑上，不需要账号，也不会上传数据。"
!define MUI_FINISHPAGE_TITLE "安装完成"
!define MUI_FINISHPAGE_TEXT "可以从开始菜单或桌面快捷方式「秒薪浮窗」打开。"
!define MUI_FINISHPAGE_RUN "$INSTDIR\WorkPrice.exe"
!define MUI_FINISHPAGE_RUN_TEXT "立即启动秒薪浮窗"

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "SimpChinese"
!insertmacro MUI_LANGUAGE "English"

VIProductVersion "${VI_VERSION}"
VIAddVersionKey /LANG=2052 ProductName "秒薪浮窗"
VIAddVersionKey /LANG=2052 FileDescription "秒薪浮窗安装程序"
VIAddVersionKey /LANG=2052 FileVersion "${VI_VERSION}"
VIAddVersionKey /LANG=2052 ProductVersion "${APP_VERSION}"
VIAddVersionKey /LANG=2052 CompanyName "ForeverPx"
VIAddVersionKey /LANG=2052 LegalCopyright "Copyright (C) 2026 ForeverPx"
VIAddVersionKey /LANG=1033 ProductName "WorkPrice"
VIAddVersionKey /LANG=1033 FileDescription "WorkPrice Setup"
VIAddVersionKey /LANG=1033 FileVersion "${VI_VERSION}"
VIAddVersionKey /LANG=1033 ProductVersion "${APP_VERSION}"
VIAddVersionKey /LANG=1033 CompanyName "ForeverPx"
VIAddVersionKey /LANG=1033 LegalCopyright "Copyright (C) 2026 ForeverPx"

Section "安装"
  SetOutPath "$INSTDIR"
  File /r "${APP_DIR}\*.*"
  WriteUninstaller "$INSTDIR\Uninstall.exe"

  CreateDirectory "$SMPROGRAMS\秒薪浮窗"
  CreateShortcut "$SMPROGRAMS\秒薪浮窗\秒薪浮窗.lnk" "$INSTDIR\WorkPrice.exe" "" "$INSTDIR\WorkPrice.exe" 0
  CreateShortcut "$SMPROGRAMS\秒薪浮窗\卸载秒薪浮窗.lnk" "$INSTDIR\Uninstall.exe"
  CreateShortcut "$DESKTOP\秒薪浮窗.lnk" "$INSTDIR\WorkPrice.exe" "" "$INSTDIR\WorkPrice.exe" 0

  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\WorkPrice" "DisplayName" "秒薪浮窗"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\WorkPrice" "UninstallString" "$\"$INSTDIR\Uninstall.exe$\""
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\WorkPrice" "DisplayIcon" "$INSTDIR\WorkPrice.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\WorkPrice" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\WorkPrice" "Publisher" "ForeverPx"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\WorkPrice" "DisplayVersion" "${APP_VERSION}"
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\WorkPrice" "NoModify" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\WorkPrice" "NoRepair" 1
SectionEnd

Section "Uninstall"
  Delete "$DESKTOP\秒薪浮窗.lnk"
  Delete "$SMPROGRAMS\秒薪浮窗\秒薪浮窗.lnk"
  Delete "$SMPROGRAMS\秒薪浮窗\卸载秒薪浮窗.lnk"
  RMDir "$SMPROGRAMS\秒薪浮窗"
  RMDir /r "$INSTDIR"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\WorkPrice"
SectionEnd
