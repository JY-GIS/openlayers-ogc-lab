# OpenLayers OGC Lab

基于 Vue 3、TypeScript、OpenLayers、GeoServer 和 PostgreSQL/PostGIS 构建的二维 WebGIS 与 OGC 标准服务实验项目。

## 系统架构

```text
浏览器
  ↓
Vue 3 + TypeScript + OpenLayers
  ↓ WMS / WMTS / WFS / WFS-T
GeoServer
  ↓ JDBC
PostgreSQL + PostGIS
```

## 技术栈

| 层级 | 技术 |
| --- | --- |
| 前端 | Vue 3、TypeScript、Vite |
| 二维地图 | OpenLayers 10 |
| 地图服务 | GeoServer 2.28.2、GeoWebCache |
| 空间数据库 | PostgreSQL 14、PostGIS 3.5 |
| 本地环境 | Docker Desktop、Docker Compose |

## 目录结构

```text
openlayers-ogc-lab/
├── frontend/                  # Vue 3 + OpenLayers 前端
│   ├── public/
│   ├── src/
│   ├── package.json
│   └── vite.config.ts
├── backend/
│   └── geoserver/             # GeoServer 配置说明与后续 SLD 样式
├── database/
│   └── create_schema.sql      # 点、线、面建表及青岛样例数据
├── docs/                      # 配置记录与后续功能截图
├── docker-compose.yml         # PostGIS 与 GeoServer 服务编排
└── README.md
```

## 测试数据

数据库统一使用 `EPSG:4326`，当前包含：

| 表 | 几何类型 | 数量 | 示例 |
| --- | --- | ---: | --- |
| `facilities` | Point | 3 | 青岛站、五四广场、中山公园 |
| `demo_roads` | LineString | 2 | 香港中路、山东路 |
| `demo_zones` | Polygon | 2 | 市南中心服务区、浮山湾休闲区 |

三张表均有稳定主键和 GiST 空间索引，为后续 WFS 查询及 WFS-T 编辑提供基础。

## 核心概念

- **WMS**：由服务端渲染地图图片，适合地图展示。
- **WMTS**：按照固定瓦片矩阵提供缓存瓦片，适合高效浏览。
- **WFS**：返回包含几何和属性的空间要素，可由前端直接渲染和查询。
- **WFS-T**：通过 WFS Transaction 完成空间要素新增、修改和删除。

## 环境要求

- Node.js 20+
- npm
- Docker Desktop
- Docker Compose

## 本地启动

### 1. 配置本地密码

在仓库根目录创建 `.env`：

```dotenv
POSTGRES_PASSWORD=请设置本机数据库密码
GEOSERVER_ADMIN_USER=admin
GEOSERVER_ADMIN_PASSWORD=请设置本机GeoServer密码
```

`.env` 已被 Git 忽略，不应提交真实密码。

### 2. 启动 PostGIS 与 GeoServer

在仓库根目录执行：

```powershell
docker compose config --quiet
docker compose up -d
docker compose ps
```

服务地址：

| 服务 | 地址 |
| --- | --- |
| PostGIS | `127.0.0.1:15434` |
| GeoServer | `http://localhost:18080/geoserver` |

PostGIS 数据卷第一次创建时，会自动执行 `database/create_schema.sql`。已有数据卷时，普通容器重启不会重复执行初始化脚本。

## GeoServer 配置

### 工作区

```text
Name: ogc_lab
Namespace URI: http://localhost/ogc_lab
```

### PostGIS 数据源

```text
Data Source Name: ogc_lab_postgis
host: postgis
port: 5432
database: ogc_lab
schema: public
user: ogc_lab
passwd: 使用 .env 中的 POSTGRES_PASSWORD
```

GeoServer 运行在 Docker 容器中，因此连接数据库时使用 Compose 服务名 `postgis` 和容器端口 `5432`，不能填写宿主机地址 `localhost:15434`。

### 已发布图层

```text
ogc_lab:facilities
ogc_lab:demo_roads
ogc_lab:demo_zones
```

## OGC 服务地址

WMS GetCapabilities：

```text
http://localhost:18080/geoserver/ogc_lab/wms?service=WMS&request=GetCapabilities
```

WFS GetCapabilities：

```text
http://localhost:18080/geoserver/ogc_lab/wfs?service=WFS&request=GetCapabilities
```

设施点 GeoJSON：

```text
http://localhost:18080/geoserver/ogc_lab/ows?service=WFS&version=2.0.0&request=GetFeature&typeNames=ogc_lab:facilities&outputFormat=application/json
```

## WMTS 瓦片服务

本项目通过 GeoServer 内置的 GeoWebCache 提供 WMTS 服务。

WMTS GetCapabilities：

```text
http://localhost:18080/geoserver/gwc/service/wmts?SERVICE=WMTS&REQUEST=GetCapabilities&VERSION=1.0.0
```

当前 `ogc_lab:facilities` 使用：

```text
TileMatrixSet: EPSG:900913
Style: point
Format: image/png
RequestEncoding: KVP
```

`EPSG:900913` 是 Web Mercator 的早期编号，与 OpenLayers 默认视图使用的 `EPSG:3857` 等价。前端读取能力文档后创建 WMTS 图层，并通过独立开关与 WMS 图层进行对比。

详细请求参数、矩阵概念、透明瓦片说明和验收记录见 [`docs/wmts.md`](docs/wmts.md)。

## WFS 要素查询

本项目通过 WFS 2.0.0 获取设施点、道路和服务范围面的 GeoJSON，并由 OpenLayers 在浏览器端绘制矢量要素。

当前 WFS 查询具备：

- 使用 `BBOX` 按地图当前范围请求点、线、面数据；
- 将服务端 `EPSG:4326` 数据转换到地图使用的 `EPSG:3857`；
- 使用不同客户端样式绘制 Point、LineString 和 Polygon；
- 点击选择要素并显示编号、名称、类型和几何类型；
- 显示加载中、成功、空结果和请求失败状态。

详细请求示例、投影转换、前端调用链和验收方式见 [`docs/wfs.md`](docs/wfs.md)。
