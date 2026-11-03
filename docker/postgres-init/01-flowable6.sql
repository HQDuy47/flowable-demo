-- Chỉ chạy khi volume PostgreSQL còn trống (lần đầu docker compose up).
-- Flowable 6.8 dùng database riêng; database "flowable" giữ schema app (loại đơn) và dữ liệu Flowable 7.1 cũ.
CREATE DATABASE flowable6 OWNER flowable;
