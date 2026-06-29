Buatkan beberapa fitur berikut di backend:
- Customer
- Vendor
- Platform / Marketplace
- Purchase Request (PR)
- Purchase Order (PO)

Fitur atau modul **Customer**:
Buatkan table customer dengan field sebagai berikut:
- id uuid
- code varchar
- name varchar
- email varchar
- type enum berupa company/personal  
- phone varchar
- is_active bool
- address text
- province varchar
- city_regency varchar
- district varchar
- village varchar
- zip_code varchar nullable
- image text nullable
Berikan juga audit log field, dan buat menjadi softdeletes

Fitur atau modul **Vendor**:
Buatkan table vendor dengan field sama seperti customer, kecuali field `type` dihilangkan.

Fitur atau modul **Platform / Marketplace**:
Buatkan table platform dengan field:
- id uuid
- code varchar
- name varchar
- image text nullable
- is_active bool
Berikan audit log field & softdeletes.

Fitur atau modul **Purchase Request (PR)**:
Table header `purchase_requests`:
- id, code, request_date, customer_id (opsional), warehouse_id (wajib), description, status (0=Draft, 1=Pending, 2=Approved, 3=Rejected, 4=Closed), requested_by (wajib, ID user), approved_by (opsional), approved_at (opsional).
Table detail `purchase_request_details`:
- id, purchase_request_id, item_id, quantity, price, total_price.

Fitur atau modul **Purchase Order (PO)**:
Table header `purchase_orders`:
- id, code, purchase_request_id (opsional), vendor_id (wajib), warehouse_id (wajib), order_date, expected_delivery_date, status (0=Draft, 1=Sent, 2=Partial Received, 3=Fully Received, 4=Cancelled), total_price, tax, discount, shipping_fee, grand_total, description.
Table detail `purchase_order_details`:
- id, purchase_order_id, item_id, quantity, received_quantity, price, total_price.
(Ada fitur goods receipt untuk update received_quantity).

Buatkan schema, controller, service, routes untuk kesemua fitur tersebut. Gunakan Drizzle ORM.
