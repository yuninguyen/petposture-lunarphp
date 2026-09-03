# Cart page UI polish — brief cho ChatGPT (2026-08-30)

File duy nhất cần sửa: `frontend/app/cart/page.tsx`, chỉ style/markup trong khu vực bảng sản phẩm (dòng 173-231). Đây là polish thuần UI: không đổi hành vi hoặc logic `updateQuantity`, `removeItem`, giá, tổng tiền, coupon; không đụng `min-w`, layout flex, hoặc sidebar.

## Vấn đề quan sát được (kèm screenshot thật từ user)

Ở viewport tablet/desktop hẹp, bảng giỏ hàng bị tràn ngang: header “Subtotal” bị cắt còn “SUBT”, và cụm quantity `− 1 +` bị bó/lệch.

Nguyên nhân gốc là `<table className="w-full ... min-w-[600px]">` tại dòng 174 có chiều rộng tối thiểu 600px nhưng nằm trong vùng `flex-1` cạnh sidebar `lg:w-[400px]` tại dòng 242. Khi viewport không đủ cho cả hai vùng, bảng bị co hẹp/clip; quantity stepper tại dòng 209-223 là phần lộ tràn rõ nhất vì mỗi nút đang dùng `px-4 py-2.5` và số lượng dùng `px-6 min-w-[50px]`.

## Ba chỉnh sửa UI cần làm

1. **Gọn quantity stepper — dòng 209-223:** giảm padding hai nút từ `px-4 py-2.5` xuống mức gọn hơn (ví dụ `px-3 py-2`); giảm vùng số từ `px-6 min-w-[50px]` xuống vừa đủ cho 1-2 chữ số (ví dụ `px-3 min-w-[32px] text-center`). Giữ nguyên chính xác hai lời gọi `updateQuantity`.
2. **Giảm ảnh sản phẩm — dòng 197-198:** đổi `w-[100px] h-[120px]` thành ảnh vuông khoảng `w-[72px] h-[72px]`, và cập nhật `sizes="100px"` thành `sizes="72px"` tương ứng.
3. **Hạ tông tên sản phẩm — dòng 200:** đổi `font-bold` thành `font-semibold`; giữ nguyên cỡ chữ, màu, hover và nội dung tên sản phẩm.

## Ngoài phạm vi

- Không sửa `min-w-[600px]` ở dòng 174, wrapper `overflow-x-auto`, `flex-1`, `lg:flex-row`, `gap-16`, hoặc bất kỳ layout bảng nào khác.
- Không đụng phần `Sidebar Totals` (dòng 241-309), bao gồm chiều rộng `lg:w-[400px]`.
- Không đổi logic `updateQuantity`/`removeItem`/tính `finalTotal`/coupon.
- Không giảm `gap-6`, `py-8`, hoặc thực hiện chỉnh sửa UI bổ sung ngoài ba mục trên.
- Không cần thêm test tự động vì không có logic mới.

## Xác minh sau khi code

Chụp screenshot ở viewport tablet/desktop hẹp để kiểm tra quantity stepper không còn lộ tràn/lệch và bảng dễ đọc hơn. Nếu hiện tượng tràn vẫn còn sau đúng ba chỉnh sửa này, dừng lại và báo cáo kết quả; chỉ khi đó mới xem xét riêng `min-w-[600px]` ở một thay đổi tiếp theo. Không commit/push; báo lại kết quả để Claude review trước khi commit.
