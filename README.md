# 無限深淵社群管理中心

此儲存庫僅發布靜態管理介面，不包含遊戲原始碼、玩家資料、PlayFab Secret 或管理員名單。

登入使用 Microsoft Entra ID；管理 API 在 Azure 獨立服務驗證權杖簽章、租用戶、API audience、客戶端、scope、管理員 Object ID 與 MFA。前端按鈕不構成授權。

所有權杖與案件資料僅留在頁面記憶體，重新整理後需重新驗證。請使用獨立瀏覽器設定檔操作後台；GitHub Pages 的其他同帳號專案可能共用瀏覽器來源。未來可改專用子網域以隔離來源。

`config.json` 僅有公開識別碼及 API 網址。`vendor/version.json` 記錄 Microsoft MSAL 套件版本與 npm 完整性值，授權條款在 vendor 目錄。

發布時只上傳本目錄，禁止上傳 SQLite、聊天快照、私人設定檔或存取權杖。教學網站的儲存庫與 Pages 設定不需修改。
