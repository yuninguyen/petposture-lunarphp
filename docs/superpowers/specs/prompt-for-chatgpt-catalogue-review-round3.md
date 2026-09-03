# Prompt round 3 — Chốt UX Catalogue và plan đủ chi tiết để bắt đầu code

> Copy toàn bộ nội dung từ phần “Vai trò” trở xuống và dán cho ChatGPT trong thread đã thực hiện round 1 và round 2.

---

## Vai trò

Tiếp tục vai trò kiến trúc sư/reviewer Laravel + LunarPHP, nhưng đây là round chốt cuối trước khi bắt đầu implementation.

Từ round này, **ChatGPT là bên trực tiếp viết code, fix bug, debug và review code** cho toàn bộ Catalogue. Claude chỉ đóng vai trò phản biện, phân tích và kiểm tra cuối trước khi commit/push/deploy. Vì vậy, đừng trả về một roadmap kiến trúc ở mức cao hoặc tiếp tục chia thành các “phase” chung chung. Tôi cần một plan tuần tự **đủ chi tiết để ChatGPT có thể bắt đầu code ngay**, đặc biệt cho module đầu tiên.

Với mỗi đề xuất, hãy:

- kiểm tra tính đúng đắn với Lunar thay vì mặc định các giả định của tôi đều đúng;
- chỉ ra phần nào bạn phản đối hoặc cần xác minh bằng runtime data;
- ưu tiên giải pháp nhỏ nhất đáp ứng use case hiện tại;
- không đơn giản hóa theo cách làm mất invariant dữ liệu;
- nêu route, request/response shape, transaction boundary, validation, test và file cần tạo/sửa khi được yêu cầu.

## Quy mô thực tế

- 1 Currency: USD.
- 1 Channel: Webstore.
- 1 Customer Group: Retail.
- 1 Tax Class: Default.
- 1 admin duy nhất.
- Site chưa live.
- Không có kế hoạch multi-currency, multi-channel, multi-customer-group hoặc nhiều admin trong tương lai gần.
- LunarPHP tiếp tục là Catalogue source of truth; không tạo model Catalogue song song.

## Các quyết định đã chốt ở round 2

Không cần tranh luận lại các quyết định sau, trừ khi bạn phát hiện chúng trực tiếp gây mất hoặc hỏng dữ liệu:

### Đã cắt

- Optimistic concurrency/version token và conflict UX `409` dành cho concurrent edit.
- Permission matrix cho nhiều role chưa tồn tại.
- Risk register, rollback steps và exit criteria lặp lại ở từng phase.
- Enterprise cutover gồm dual-read framework, feature flags, metrics/alerts và thời gian quan sát kiểu production lớn.
- Pricing grid đa currency/customer group/tier và bulk apply UI ở v1.
- Collection Group CRUD khỏi React UI. Runtime hiện chỉ có một group; backend tự gán Collection Group mặc định.

### Giữ nhưng làm gọn

- Cutover theo từng module: test và smoke test xong thì ẩn navigation Filament tương ứng; có thể giữ direct route fallback ngắn hạn, không cần một phase cutover riêng.
- UI pricing chỉ hiện default price/compare price, nhưng backend không được làm phẳng hoặc xóa price context.

### Bốn invariant data-safety bắt buộc

1. **Price identity:** backend/DB vẫn phải lưu và tìm đúng row theo đủ `priceable_type + priceable_id + currency_id + customer_group_id + min_quantity`, giữ minor-unit semantics, dù React chỉ hiển thị một ô giá mặc định.
2. **Variant stable ID:** update variant phải diff theo stable ID; không delete/recreate toàn bộ matrix vì ID có thể đã nằm trong cart/order/reference.
3. **Locale merge:** partial locale update phải merge; không được xóa bản dịch của locale không xuất hiện trong payload.
4. **Legacy cleanup:** thực hiện ở release riêng và chỉ xóa sau dependency proof; không trộn cleanup legacy vào lúc build Catalogue React.

Các nguyên tắc data-safety liên quan vẫn giữ: aggregate write nhiều bảng có transaction boundary, delete guard cho resource đang được tham chiếu và Lunar là write target duy nhất của admin mới.

## Ba phát hiện mới cần đưa vào plan

### 1. Attribute v1 chỉ cần FieldType Text

Static search trong codebase hiện chỉ tìm thấy `Lunar\FieldTypes\Text`; chưa thấy Number, Dropdown, List hoặc Boolean được sử dụng. Theo nguyên tắc không xây tính năng ngoài nhu cầu thật:

- React v1 chỉ cần form control cho FieldType Text.
- Không xây generic form builder cho mọi Lunar FieldType.
- Contract có thể giữ trường `type`/`field_type` để còn đường mở rộng, nhưng backend v1 phải validate allow-list rõ ràng, không nhận class name tùy ý từ client.

Hãy lưu ý: static grep không chứng minh chắc chắn dữ liệu runtime không có FieldType khác. Trước khi chốt allow-list Text-only, hãy yêu cầu một runtime query/report để xác nhận các giá trị `attributes.type` đang tồn tại ở môi trường đích và đề xuất hành vi nếu gặp type chưa hỗ trợ: read-only/unsupported badge hay chặn editor, tuyệt đối không âm thầm làm mất configuration/data.

### 2. Media phải tái sử dụng component/API có sẵn

Dự án đã có:

- `admin/src/features/media/MediaPicker.tsx`;
- `admin/src/components/ui/media-library-modal.tsx`;
- shared media API `GET /admin/media` và `POST /admin/media` được component sử dụng để chọn/upload ảnh.

Brand, Collection và Product phải tái sử dụng `MediaPicker.tsx`; không xây lại media library, upload modal hoặc upload endpoint riêng cho từng Catalogue resource.

Tuy nhiên, hãy phân biệt rõ:

- upload/chọn một shared media item;
- attach/detach media item đó vào Lunar Brand/Collection/Product;
- primary image/gallery/reorder semantics của Lunar/Spatie.

Việc có `MediaPicker.tsx` không tự động chứng minh rằng chỉ gửi một `media_id` là đủ cho mọi relation. Hãy kiểm tra và nêu chính xác Catalogue endpoint/payload nào vẫn cần để lưu association, primary image hoặc gallery; chỉ cắt phần upload/library bị trùng lặp.

### 3. Hướng UX mới: ẩn ProductType hoàn toàn khỏi UI

Bảng so sánh định hướng UX:

| Khía cạnh | Shopify | WooCommerce | Lunar hiện tại |
|---|---|---|---|
| “Product Type” | Field text/taxonomy phục vụ tổ chức và lọc; không quyết định toàn bộ form | Loại built-in như Simple/Variable/Grouped/External | Entity riêng dùng để map Product Attributes và Variant Attributes |
| Custom field | Metafields, thường được giấu sau UX chuyên biệt | Custom fields/attributes, có thể mở rộng bằng plugin | Attribute System/FieldType generic |
| Trải nghiệm merchant | Không bắt người dùng hiểu schema engine nội bộ | Chỉ lộ những lựa chọn sát nghiệp vụ | Có nguy cơ bắt admin hiểu cấu trúc framework |

Định hướng đề xuất:

- Không sửa hoặc bỏ schema `ProductType`/`Attribute` của Lunar; giữ tương thích với Lunar update.
- Backend dùng một Product Type mặc định tên `General`. Migration `2026_05_22_000001_ensure_lunar_default_records.php` hiện tạo `General` khi chưa có Product Type, nhưng điều này chưa tự đảm bảo runtime luôn đúng một record; plan phải nêu cách resolve/verify canonical default an toàn.
- Không làm Product Type CRUD hoặc Product Type picker trong React.
- Không nhắc “Product Type” trong UI/copy của admin mới.
- Attribute System được trình bày thành **Custom Fields**: một nơi quản lý field tùy chỉnh, với target Product hoặc Variant.
- Product form hiển thị trực tiếp toàn bộ Custom Fields đã map vào Product Type `General`; tạo Product tự động gán `General`.
- Khi tạo/sửa Custom Field, backend phải xử lý đúng Lunar Attribute Group và mapping vào `General`; không được chỉ ẩn UI rồi bỏ quên các relation mà Lunar cần.
- Collection Group cũng là implementation detail bị ẩn: Collection create tự gán group mặc định, nhưng backend phải fail rõ ràng nếu default group thiếu hoặc mơ hồ thay vì chọn `first()` tùy tiện.

## Bốn câu hỏi cần trả lời

### 1. Phản biện quyết định ẩn ProductType

Bạn có đồng ý với hướng **ẩn hoàn toàn ProductType khỏi React UI nhưng giữ nguyên schema và relation Lunar** không?

Hãy kiểm tra, phân tích và phản biện cụ thể:

- Đây có thực sự là cách đơn giản hóa UX hợp lý, hay đang che một khái niệm mà admin sớm muộn vẫn cần?
- Việc tất cả Product dùng `General` có ảnh hưởng gì tới mapping product attributes/variant attributes, validation, editor schema hoặc Lunar upgrade?
- Backend phải có invariant/guard nào để không vô tình tạo Product Type thứ hai hoặc gán nhầm type?
- Cần xác minh runtime data gì trước khi khóa UX này?
- Nếu bạn không đồng ý, hãy đề xuất phương án nhỏ hơn nhưng vẫn tránh bắt một admin hiểu schema engine của Lunar.

Kết luận câu này phải là một quyết định rõ: **chấp nhận / chấp nhận có điều kiện / không chấp nhận**, kèm điều kiện và cách kiểm chứng.

### 2. Cập nhật plan cuối còn bốn module UI

Viết lại plan theo đúng thứ tự, không dùng format phase:

1. Custom Fields — implementation bên dưới vẫn là Lunar Attribute System.
2. Brand.
3. Collection — không có Collection Group UI.
4. Product — không có Product Type picker/UI.

Ngoài bốn module UI, thêm một mục backend setup nhỏ cho:

- canonical Product Type `General`;
- hidden Attribute Group(s) cần thiết cho Product và Variant;
- default Collection Group;
- default Currency/Channel/Customer Group/Tax Class resolver.

Với mỗi module, nêu:

- workflow người dùng tối thiểu;
- endpoint tối thiểu;
- số route/màn hình React tối thiểu;
- phần tái sử dụng từ code hiện có;
- transaction và delete guard cần thiết;
- test tập trung vào invariant;
- điều kiện để ẩn navigation Filament.

Brand/Collection/Product phải tái sử dụng `MediaPicker.tsx`; không tính media library/upload UI là một màn hình mới.

### 3. Viết Module 1 đủ chi tiết để code ngay

Viết implementation plan chi tiết cho **Custom Fields** để ChatGPT có thể bắt đầu code ngay sau câu trả lời, bao gồm tối thiểu:

#### Backend Laravel

- Exact routes dưới `/api/admin/*`, theo convention explicit routes hiện tại.
- Controller/action/Form Request/API Resource cần dùng.
- Request JSON cho create và update.
- Response JSON cho list/detail/create/update.
- Error shape/status cho validation, unsupported FieldType, duplicate handle, delete đang được tham chiếu và missing/multiple `General` Product Type.
- Quy tắc sinh/validate `handle`.
- Quy tắc locale merge cho name nếu name localized trong Lunar model hiện tại.
- Cách map target `product` hoặc `variant` sang đúng Attribute Group và Product Type `General`.
- Transaction boundary.
- Delete semantics: trường hợp nào được xóa, trường hợp nào phải chặn.
- Cách trả về FieldType chưa được UI hỗ trợ mà không làm mất dữ liệu.
- Feature tests cần viết.

#### Admin React

- Exact route React và navigation label “Custom Fields”.
- Có cần một list page + modal/drawer editor hay list page + form route; hãy chọn phương án ít code nhất mà vẫn dùng tốt.
- TypeScript types.
- API client/hooks hoặc query keys.
- Form fields tối thiểu cho Text: name, handle, target Product/Variant, required nếu Lunar support/use case cần, và configuration thật sự cần thiết.
- Validation/error handling.
- i18n keys.
- Component tests tối thiểu.

#### Danh sách file

Liệt kê cụ thể theo nhóm:

- file backend cần tạo;
- file backend cần sửa;
- file admin cần tạo;
- file admin cần sửa;
- file test cần tạo/sửa.

Dùng đường dẫn dự kiến phù hợp convention repository hiện tại. Nếu chưa đủ bằng chứng để biết đúng basename/convention, hãy ghi rõ file nào phải inspect trước thay vì bịa tên.

Cuối Module 1, đưa ra thứ tự implementation dạng checklist nhỏ, mỗi bước có cách verify, để bên code có thể thực hiện tuần tự ngay.

### 4. Cái giá phải trả khi scale lên

Giữ các trade-off đã xác định ở round 2 cho:

- nhiều Currency/Customer Group/tier pricing;
- nhiều Channel;
- nhiều admin và optimistic concurrency;
- nhiều role và permission matrix;
- site live cần staged rollout/observability;
- catalogue lớn cần search index, pagination và performance work.

Bổ sung riêng trade-off của việc ẩn ProductType:

- trigger nào cho thấy đã cần Product Type thứ hai thật;
- cần thêm lại UI, API và mapping workflow nào;
- cách phân loại/reassign Product hiện có từ `General` sang type mới;
- cách giữ ID và `attribute_data` hiện có;
- cách xử lý attribute chung và attribute riêng theo type;
- migration/backfill/test nào cần thiết;
- phần nào nếu thiết kế đúng từ bây giờ sẽ giúp “hiện lại” ProductType mà không phá dữ liệu.

## Format đầu ra bắt buộc

1. **Executive verdict** về quyết định ẩn ProductType.
2. **Các điều kiện/runtime facts cần xác minh trước khi code**.
3. **Backend setup cho các implementation detail bị ẩn**.
4. **Plan bốn module UI**.
5. **Module 1 — code-ready specification** gồm routes, JSON contracts, validation, transaction, tests và file list.
6. **Cutover tối thiểu theo module**.
7. **Trade-offs khi scale**, có mục ProductType riêng.
8. **Những điểm bạn phản đối hoặc sửa so với giả định của tôi**.

Không tiếp tục viết một plan 10–12 phase. Không đề xuất abstraction hoặc UI cho use case chưa tồn tại. Nhưng cũng không được đồng ý máy móc với hướng ẩn ProductType nếu việc đó bỏ sót relation/invariant bắt buộc của Lunar.