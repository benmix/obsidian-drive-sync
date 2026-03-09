# 验证步骤

## 认证与会话生命周期

1. 在 Obsidian 中执行命令 **Sign in to remote provider**。
2. 输入 provider 账号凭据（如有提示，也输入 2FA / mailbox password）。
3. 确认出现成功提示，并且 **Show sync status** 显示认证状态为 OK。
4. 关闭并重新打开 Obsidian。
5. 执行 **Connect remote provider**，确认无需重新登录即可恢复会话。
6. 执行 **Sign out of remote provider**，确认状态显示会话已清除。

## 远端操作（CRUD）与 UID 稳定性

1. 确保已经设置 **Remote folder**。
2. 执行 **Validate remote operations**。
3. 确认出现成功提示。
4. 如果验证失败，打开开发者控制台查看失败步骤。

该验证会执行：

- 对远端根目录执行 `list`
- 创建测试文件夹
- 上传测试文件
- 下载并比对内容
- 上传一个新 revision，并确认节点 `uid` 保持稳定而 revision 发生变化
- 移动并重命名节点，并确认 `uid` 仍保持稳定
- 删除节点并清理测试文件夹
