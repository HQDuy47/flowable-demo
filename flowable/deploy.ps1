# Đóng gói quy trình + form thành leave-app.bar (zip) và deploy lên Flowable.
# Chạy lại sau mỗi lần restart container (DB in-memory sẽ mất hết).
# Lưu ý: không dùng `tar -a` để tạo file .bar vì nó ra tar chứ không phải zip.
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$base = "http://localhost:8081/flowable-rest/service"
Remove-Item leave-app.bar, leave-app.zip -ErrorAction SilentlyContinue
Compress-Archive -Path leave-request.bpmn20.xml, leaveRequestForm.form, approveLeaveForm.form -DestinationPath leave-app.zip
Rename-Item leave-app.zip leave-app.bar

curl.exe -s -u rest-admin:test -F "file=@leave-app.bar" "$base/repository/deployments"
""
curl.exe -s -u rest-admin:test "$base/repository/process-definitions?key=leaveRequest&latest=true"
