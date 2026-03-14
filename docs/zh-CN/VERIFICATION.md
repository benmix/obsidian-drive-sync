# 验证步骤

这份文档列出即使 lint、test、build 都通过，仍然值得手动确认的流程。

## 认证与会话生命周期

1. 在 Obsidian 中执行 **Sign in to remote provider**。
2. 输入 provider 凭据，以及可能需要的 2FA 或 mailbox password。
3. 确认出现成功提示。
4. 打开 **Show sync status**，确认认证状态正常。
5. 关闭并重新打开 Obsidian。
6. 执行 **Connect remote provider**，确认无需重新登录即可恢复会话。
7. 执行 **Sign out of remote provider**，确认会话被清除。

预期结果：

- 登录成功
- 重启后会话能够恢复
- 登出会清除存储会话，并更新状态 UI

## 远端操作与 UID 稳定性

1. 确保已经选择 **Remote folder**。
2. 执行 **Validate remote operations**。
3. 确认命令执行成功。
4. 如果失败，查看开发者控制台和结构化日志，确认失败发生在哪一步。

验证流程应覆盖：

- 对远端根目录执行 `list`
- 创建测试文件夹
- 上传测试文件
- 下载并比对内容
- 二次上传，确认远端 revision 改变但节点 `uid` 保持稳定
- 执行移动和重命名，确认节点 `uid` 仍然稳定
- 删除测试节点并清理测试目录

预期结果：

- 每一步都成功
- 重命名和新 revision 上传后，节点 `uid` 仍保持稳定
- 清理结束后不留下测试残留数据
