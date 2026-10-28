param([Parameter(Mandatory = $true)][string]$OutDir)
# Builds the same workbook in Excel and saves it as XLSX, XLS and XLSB.
$ErrorActionPreference = 'Stop'
# COM passes the thread culture to Excel; under ru-RU it stores 'h:mm' as the literal text \h\:\m\m.
[System.Threading.Thread]::CurrentThread.CurrentCulture = [System.Globalization.CultureInfo]::GetCultureInfo('en-US')
function Set-NumberFormat($range, [string]$format) {
  # Late-bound COM calls carry the caller's LCID; pass en-US explicitly so Excel reads English format codes.
  [void][System.__ComObject].InvokeMember('NumberFormat', [System.Reflection.BindingFlags]::SetProperty, $null, $range, @($format), [System.Globalization.CultureInfo]::GetCultureInfo('en-US'))
}
New-Item -ItemType Directory -Force $OutDir | Out-Null
$excel = New-Object -ComObject Excel.Application
try {
  $excel.Visible = $false
  $excel.DisplayAlerts = $false
  $wb = $excel.Workbooks.Add()
  while ($wb.Worksheets.Count -lt 3) { [void]$wb.Worksheets.Add([Type]::Missing, $wb.Worksheets.Item($wb.Worksheets.Count)) }

  $ws = $wb.Worksheets.Item(1)
  $ws.Name = 'Cells'
  $ws.Range('A1').Value2 = 'case'
  $ws.Range('B1').Value2 = 'value'
  $ws.Range('A2').Value2 = 'padded text'
  $ws.Range('B2').Value2 = '  padded  '
  $ws.Range('A3').Value2 = 'blank text'
  $ws.Range('B3').Value2 = '   '
  $ws.Range('A4').Value2 = 'formula error'
  $ws.Range('B4').Formula = '=1/0'
  $ws.Range('A5').Value2 = 'error constant'
  $ws.Range('B5').Formula = '#N/A'
  $ws.Range('A6').Value2 = 'error-like text'
  Set-NumberFormat $ws.Range('B6') '@'
  $ws.Range('B6').Value2 = '#N/A'
  $ws.Range('A7').Value2 = 'time'
  Set-NumberFormat $ws.Range('B7') 'h:mm'
  $ws.Range('B7').Value2 = 0.6666666666666666
  $ws.Range('A8').Value2 = 'date time'
  Set-NumberFormat $ws.Range('B8') 'yyyy-mm-dd hh:mm'
  $ws.Range('B8').Value2 = 46247.395833333336
  $ws.Range('A9').Value2 = 'date'
  Set-NumberFormat $ws.Range('B9') 'dd.mm.yyyy'
  $ws.Range('B9').Value2 = 46247
  $ws.Range('A10').Value2 = 'number'
  $ws.Range('B10').Value2 = 3.14
  $ws.Range('A11').Value2 = 'boolean'
  $ws.Range('B11').Value2 = $true
  $ws.Range('A12').Value2 = 'formula'
  $ws.Range('B12').Formula = '=2+3'
  $ws.Range('A13').Value2 = 'formula text'
  $ws.Range('B13').Formula = '="  spaced  "'
  # Row 14 is empty; row 15 holds only cells the converter drops.
  $ws.Range('B15').Value2 = '  '
  $ws.Range('C15').Formula = '=1/0'
  $ws.Range('A16').Value2 = 'after gap'
  $ws.Range('D16').Value2 = 'wide'
  $ws.Range('A17').Value2 = 'Кириллица'
  $ws.Range('A18').Value2 = 'seconds'
  Set-NumberFormat $ws.Range('B18') 'yyyy-mm-dd hh:mm:ss'
  $ws.Range('B18').Value2 = 19278.607951388888
  $ws.Range('A19').Value2 = 'early 1900 date'
  Set-NumberFormat $ws.Range('B19') 'yyyy-mm-dd'
  $ws.Range('B19').Value2 = 32

  $second = $wb.Worksheets.Item(2)
  $second.Name = 'Second'
  $second.Range('A1').Value2 = 'x'
  $hidden = $wb.Worksheets.Item(3)
  $hidden.Name = 'Hidden'
  $hidden.Range('A1').Value2 = 'secret'
  $hidden.Visible = 0

  $ws.Activate()
  $base = Join-Path $OutDir 'sheet-cells'
  $wb.SaveAs("$base.xlsx", 51)
  $wb.SaveAs("$base.xlsb", 50)
  $wb.SaveAs("$base.xls", 56)
  $wb.Close($false)
}
finally {
  $excel.Quit()
  [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel)
  [GC]::Collect()
  [GC]::WaitForPendingFinalizers()
}
Get-ChildItem $OutDir -Filter 'sheet-cells.*' | Select-Object Name, Length
