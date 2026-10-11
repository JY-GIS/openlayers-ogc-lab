# WMTS 与 GeoWebCache 配置及验收记录

## 服务入口

本项目使用 GeoServer 内置的 GeoWebCache 提供 WMTS 服务：

```text
http://localhost:18080/geoserver/gwc/service/wmts
```

WMTS `GetCapabilities`：

```text
http://localhost:18080/geoserver/gwc/service/wmts?SERVICE=WMTS&REQUEST=GetCapabilities&VERSION=1.0.0
```


## 已发布图层

GeoWebCache 能力文档中包含：

```text
ogc_lab:facilities
ogc_lab:demo_roads
ogc_lab:demo_zones
```

三个图层均提供以下格式和矩阵集：

| 配置 | 可用值 |
| --- | --- |
| 图片格式 | `image/png`、`image/jpeg` |
| 瓦片矩阵集 | `EPSG:4326`、`EPSG:900913` |

当前前端首先接入 `ogc_lab:facilities`，使用配置：

```text
Layer: ogc_lab:facilities
Style: point
Format: image/png
TileMatrixSet: EPSG:900913
RequestEncoding: KVP
```

## 为什么选择 EPSG:900913

OpenLayers 默认地图视图使用 `EPSG:3857`。GeoWebCache 能力文档将对应的 Web Mercator 瓦片矩阵集标识为 `EPSG:900913`。

`EPSG:900913` 是 Web Mercator 的早期非正式编号，与 `EPSG:3857` 使用相同的投影方式。这里的名称必须按照 WMTS 能力文档填写，否则无法匹配服务端声明的瓦片矩阵集。

当前矩阵集包含 31 个缩放层级，编号从：

```text
EPSG:900913:0
```

到：

```text
EPSG:900913:30
```

每张瓦片为 `256 × 256` 像素。

## GetTile 请求示例

设施点图层的 KVP 请求示例：

```text
http://localhost:18080/geoserver/gwc/service/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ogc_lab:facilities&STYLE=point&TILEMATRIXSET=EPSG:900913&FORMAT=image/png&TILEMATRIX=EPSG:900913:12&TILEROW=1607&TILECOL=3416
```

核心参数：

| 参数 | 含义 |
| --- | --- |
| `LAYER` | GeoWebCache 中的图层标识 |
| `STYLE` | GeoServer 图层样式 |
| `FORMAT` | 返回的瓦片图片格式 |
| `TILEMATRIXSET` | 一组统一投影和缩放规则 |
| `TILEMATRIX` | 当前缩放层级 |
| `TILEROW` | 当前瓦片行号 |
| `TILECOL` | 当前瓦片列号 |

实际验收中，该请求返回：

```text
Status: 200
Content-Type: image/png
Tile size: 256 × 256
```

## 前端加载流程

```text
App.vue
  ↓ 调用 createFacilitiesWmtsLayer()
ogcWmts.ts
  ↓ fetch GetCapabilities
GeoWebCache
  ↓ 返回 WMTS XML
WMTSCapabilities
  ↓ 解析能力对象
optionsFromCapabilities()
  ↓ 生成 WMTS source 配置
TileLayer + WMTS
  ↓ map.addLayer()
OpenLayers 地图
```

地图会先显示底图和已有 WMS 图层，再异步读取 WMTS 能力文档。WMTS 图层创建完成后通过 `map.addLayer()` 加入地图，不阻塞基础地图初始化。

## KVP 与 REST 请求编码

WMTS 可以使用两种常见请求编码：

- `KVP`：通过 `SERVICE`、`LAYER`、`TILEMATRIX`、`TILEROW`、`TILECOL` 等查询参数描述请求。
- `REST`：将图层、矩阵、行号和列号放入 URL 路径。

本项目使用 `KVP`。GeoWebCache 能力文档同时提供 PNG 和 JPEG 两个 REST 瓦片模板，而设施点属于需要叠加在底图上的业务图层。明确使用 KVP 并指定 `FORMAT=image/png`，可以确保返回支持透明背景的 PNG，避免 JPEG 的不透明背景遮挡底图。

## WMTS 与 WMS 的区别

| 对比项 | WMS | WMTS |
| --- | --- | --- |
| 请求范围 | 使用动态 `BBOX` | 使用固定瓦片行列号 |
| 图片尺寸 | 通过 `WIDTH`、`HEIGHT` 指定 | 通常固定为 `256 × 256` |
| 缩放方式 | 可按任意范围动态渲染 | 使用预先定义的 TileMatrix |
| 服务端工作 | 按请求实时渲染 | 优先读取缓存瓦片 |
| 适用场景 | 样式和范围灵活的动态地图 | 高频浏览、固定样式地图 |

## 缓存更新说明

GeoWebCache 会按照图层、样式、图片格式、矩阵集、矩阵层级、行号和列号缓存瓦片。

数据库数据更新后，已经生成的旧瓦片不会自动代表最新数据。开发阶段如果发现数据库和 WMTS 显示不一致，需要在 GeoServer 的 Tile Layers 页面中对对应图层执行缓存清理或重新播种，再重新请求瓦片。

WMS 通常按当前请求重新渲染，因此可以用于对照判断：

```text
WMS 已更新、WMTS 未更新
  ↓
优先检查 GeoWebCache 是否仍在返回旧缓存
```

