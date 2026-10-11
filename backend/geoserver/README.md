# GeoServer 配置

本项目服务端空间数据能力由 GeoServer 和 PostGIS 提供。

## 服务结构

```text
OpenLayers
  ↓ WMS / WMTS / WFS / WFS-T
GeoServer
  ↓ JDBC
PostgreSQL / PostGIS
```

## GeoServer 配置

```text
访问地址：http://localhost:18080/geoserver
工作区：ogc_lab
数据源：ogc_lab_postgis
数据库：ogc_lab
Schema：public
```

GeoServer 容器连接 PostGIS 时使用：

```text
host: postgis
port: 5432
database: ogc_lab
schema: public
user: ogc_lab
```

数据库密码读取根目录本地 `.env` 中的 `POSTGRES_PASSWORD`。

容器内部不能使用 `localhost:15434` 连接 PostGIS。`localhost` 在 GeoServer 容器中代表 GeoServer 容器自己，两个服务之间应通过 Compose 服务名 `postgis` 通信。

## 已发布图层

```text
ogc_lab:facilities
ogc_lab:demo_roads
ogc_lab:demo_zones
```

三个图层已通过 WMS 图片请求和 WFS GeoJSON 请求验证。

## 样式目录

`styles/` 用于后续保存 GeoServer SLD 样式文件。
