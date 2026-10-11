# GeoServer 与 PostGIS 配置记录

## 本地服务

| 服务 | 地址 |
| --- | --- |
| PostGIS | `127.0.0.1:15434` |
| GeoServer | `http://localhost:18080/geoserver` |
| Vite 前端 | `http://localhost:5173` |

## 本地环境变量

根目录 `.env` 需要包含：

```dotenv
POSTGRES_PASSWORD=本机数据库密码
GEOSERVER_ADMIN_USER=admin
GEOSERVER_ADMIN_PASSWORD=本机GeoServer密码
```

`.env` 已被 Git 忽略，不提交真实密码。

## 启动服务

在仓库根目录执行：

```powershell
docker compose config --quiet
docker compose up -d
docker compose ps
```

查看启动日志：

```powershell
docker compose logs --tail=100 postgis geoserver
```

## PostGIS 数据

数据库初始化脚本为：

```text
database/create_schema.sql
```

脚本创建：

- `facilities`：3 个青岛设施点。
- `demo_roads`：2 条青岛演示道路。
- `demo_zones`：2 个青岛演示区域。
- 三个 GiST 空间索引。
- 所有几何统一使用 `EPSG:4326`。

该脚本只会在 PostGIS 数据卷第一次创建且为空时自动执行。已有数据卷时，普通容器重启不会重新执行初始化脚本。

## GeoServer 工作区

```text
Workspace: ogc_lab
Namespace URI: http://localhost/ogc_lab
```

## PostGIS 数据源

```text
Data Source Name: ogc_lab_postgis
host: postgis
port: 5432
database: ogc_lab
schema: public
user: ogc_lab
passwd: 使用 .env 中的 POSTGRES_PASSWORD
```

GeoServer 位于 Docker 容器中，因此连接 PostGIS 时使用 `postgis:5432`，不能使用宿主机地址 `localhost:15434`。

## 已发布图层

```text
ogc_lab:facilities
ogc_lab:demo_roads
ogc_lab:demo_zones
```

发布图层时，声明坐标系使用 `EPSG:4326`，并分别通过 `Compute from data` 和 `Compute from native bounds` 计算边界范围。

## 服务验收

M1 阶段已完成以下实际验收：

- `facilities` 的 WFS 请求返回 3 个 Point。
- `demo_roads` 的 WFS 请求返回 2 个 LineString。
- `demo_zones` 的 WFS 请求返回 2 个 Polygon。
- 三个图层的 SRID 均为 `4326`。
- 组合 WMS GetMap 请求返回 `200 image/png`。
- PostGIS 和 GeoServer 容器均为 `healthy`。

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
