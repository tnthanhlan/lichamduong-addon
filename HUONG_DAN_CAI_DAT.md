# Hướng dẫn cài "Lịch Âm Dương" qua GitHub + Add-on Store

Không cần Samba, SSH hay bất kỳ dòng lệnh nào trong Home Assistant. Toàn bộ thao
tác đều là kéo-thả và bấm nút, giống hệt cách bạn đã làm với app chấm công CT34.

## Bước 1 — Tạo repo GitHub và upload thư mục này

1. Vào **github.com** → đăng nhập tài khoản `tnthanhlan`
2. Góc trên bên phải → dấu **+** → **New repository**
3. Đặt tên: `lichamduong-addon` → chọn **Public** → **Create repository**
4. Trong trang repo vừa tạo (còn trống) → bấm **"uploading an existing file"**
   (dòng chữ xanh giữa trang)
5. Kéo thả **toàn bộ nội dung** đã giải nén từ file zip mình gửi vào ô upload —
   tức là kéo cả 2 mục: file `repository.yaml` và thư mục `lichamduong` (kéo
   nguyên thư mục, GitHub tự giữ đúng cấu trúc bên trong)
6. Cuộn xuống, bấm **Commit changes**

## Bước 2 — Trỏ Home Assistant vào repo đó

1. Home Assistant → **Settings** → **Add-ons** → **Add-on Store**
2. Góc trên bên phải, bấm nút **"⋮" (ba chấm)** → **Repositories**
3. Dán vào ô trống: `https://github.com/tnthanhlan/lichamduong-addon` → **Add** → **Close**
4. Đợi vài giây, cuộn xuống cuối trang Add-on Store sẽ thấy mục mới xuất hiện,
   bấm vào add-on **"Lịch Âm Dương"**
5. Bấm **Install** → đợi build xong (vài phút, do phải tải Node.js + cloudflared)

## Bước 3 — Tạo Cloudflare Tunnel riêng cho add-on này

Giống hệt cách đã làm cho app chấm công CT34 — 1 tunnel riêng, tách biệt với
tunnel chính của Home Assistant:

1. **Cloudflare Zero Trust dashboard** → **Networks** → **Tunnels**
2. **Create a tunnel** → chọn Cloudflared → đặt tên, ví dụ `lichamduong`
3. Copy đoạn **token** hiển ra (chuỗi dài)
4. Ngay trong màn hình tạo tunnel đó, ở bước "Add a public hostname":
   - Subdomain: `lich`
   - Domain: `tnthanhlan.trade`
   - Service Type: `HTTP`
   - URL: `localhost:8099`
5. Save tunnel

## Bước 4 — Gỡ domain cũ khỏi Cloudflare Pages

Vì `lich.tnthanhlan.trade` hiện đang trỏ vào bản Cloudflare Pages cũ, cần gỡ ra
trước để tránh xung đột với tunnel mới:

1. Cloudflare dashboard → **Workers & Pages** → project cũ (`nameless-wildflower-7d4a`)
2. Tab **Domains** → tìm `lich.tnthanhlan.trade` → bấm "..." → **Remove domain**

## Bước 5 — Dán token vào add-on

1. Home Assistant → add-on "Lịch Âm Dương" → tab **Configuration**
2. Dán token đã copy ở Bước 3 vào ô `cloudflare_tunnel_token` → **Save**
3. Qua tab **Info** → bấm **Start**, bật luôn "Start on boot" và "Watchdog"

## Bước 6 — Kiểm tra

Đợi khoảng 1-2 phút, mở `https://lich.tnthanhlan.trade` trên điện thoại lẫn máy
tính — cả hai giờ sẽ cùng đọc từ 1 nguồn dữ liệu trên Mini PC.

## Bước 7 — Chuyển nhắc nhở cũ (nếu có)

Nếu điện thoại bạn đang có sẵn nhắc nhở lưu kiểu cũ (bản Cloudflare Pages trước
đây):

1. Mở bản cũ trên điện thoại → bấm **"Tải file sao lưu"** → được file `.json`
2. Mở bản mới (sau khi đã trỏ qua add-on) → bấm **"Khôi phục từ file"** → chọn
   file vừa tải
3. Toàn bộ nhắc nhở cũ sẽ được gộp vào server dùng chung

## Sau này muốn sửa/cập nhật add-on thì sao?

Mỗi lần muốn cập nhật code: sửa file ngay trên GitHub web (bấm cây bút ✏️ ở góc
file đó) hoặc upload đè file mới lên bằng đúng cách ở Bước 1, rồi trong Home
Assistant vào add-on → **Rebuild**. Không cần làm lại từ đầu các bước tunnel.

## Dữ liệu lưu ở đâu?

File `reminders.json` nằm trong thư mục dữ liệu riêng của add-on (`/data`), do
Home Assistant Supervisor tự quản lý, giữ nguyên qua các lần cập nhật/khởi động
lại add-on — không nằm trong repo GitHub, không bị mất khi bạn sửa code.
