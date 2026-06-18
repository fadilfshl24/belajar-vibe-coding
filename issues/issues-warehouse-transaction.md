Buatkan issue.md yang berisi perencanaan untuk nanti di implementasikan oleh junior programmer
atau AI model yang lebih murah.

Isi dari planning nya adalah sebagai berikut :

Tambahkan system logging untuk setiap transaksi yang terjadi di sistem ini.
Untuk detail table logging sebagai berikut :
logging_transactions
    - id (UUID, PK, AUTO_INCREMENT)
    - reference_document (VARCHAR)
    - transaction_type (VARCHAR)
    - user_id (UUID, FK)
    - warehouse_id (UUID,FK)
    -

Dan jika ada transaksi
