# WFS 要素查询与验收记录

## 服务入口

本项目使用 GeoServer 工作区 `ogc_lab` 提供的 WFS 2.0.0 服务。

GetCapabilities：

```text
http://localhost:18080/geoserver/ogc_lab/wfs?service=WFS&version=2.0.0&request=GetCapabilities
```

DescribeFeatureType：

```text
http://localhost:18080/geoserver/ogc_lab/wfs?service=WFS&version=2.0.0&request=DescribeFeatureType&typeNames=ogc_lab:facilities,ogc_lab:demo_roads,ogc_lab:demo_zones
```

## 已查询图层

| 图层 | 几何类型 | 主要属性 |
| --- | --- | --- |
| `ogc_lab:facilities` | Point | `id`、`name`、`facility_type`、`description` |
| `ogc_lab:demo_roads` | LineString | `id`、`name`、`road_level` |
| `ogc_lab:demo_zones` | Polygon | `id`、`name`、`zone_type` |

三个图层的数据坐标系均为 `EPSG:4326`。

## GetFeature 请求示例

查询设施点并返回 GeoJSON：

```text
http://localhost:18080/geoserver/ogc_lab/ows?service=WFS&version=2.0.0&request=GetFeature&typeNames=ogc_lab:facilities&outputFormat=application/json&srsName=EPSG:4326
```

按青岛测试区域查询设施点：

```text
http://localhost:18080/geoserver/ogc_lab/ows?service=WFS&version=2.0.0&request=GetFeature&typeNames=ogc_lab:facilities&outputFormat=application/json&srsName=EPSG:4326&bbox=120.3,36,120.4,36.1,EPSG:4326
```

主要参数：

| 参数 | 用途 |
| --- | --- |
| `service=WFS` | 指定请求 WFS 服务 |
| `version=2.0.0` | 使用 WFS 2.0.0 |
| `request=GetFeature` | 请求空间要素及其属性 |
| `typeNames` | 指定需要查询的 GeoServer 图层 |
| `outputFormat=application/json` | 请求 GeoJSON 响应 |
| `srsName=EPSG:4326` | 指定返回数据的坐标系 |
| `bbox` | 只查询指定空间范围内的要素 |

当前 GeoServer 配置下，`EPSG:4326` BBOX 使用以下顺序：

```text
minLon,minLat,maxLon,maxLat,EPSG:4326
```

## 前端加载流程

```text
OpenLayers 当前视图范围（EPSG:3857）
  → transformExtent 转换为 EPSG:4326
  → 生成包含 BBOX 的 WFS GetFeature URL
  → GeoServer 返回 GeoJSON
  → GeoJSON.readFeatures 读取要素
  → 从 EPSG:4326 转换到 EPSG:3857
  → VectorSource 保存 Feature
  → VectorLayer 在浏览器端绘制点、线、面
```

`bboxStrategy` 根据地图范围触发加载，并记录已经加载过的范围。请求失败时调用 `removeLoadedExtent` 撤销记录，使后续地图操作可以重新请求该范围。

## 投影处理

地图视图使用 Web Mercator，即 `EPSG:3857`；PostGIS 和 WFS 测试数据使用经纬度坐标，即 `EPSG:4326`。

发送 BBOX 请求前，需要把地图范围从 `EPSG:3857` 转成 `EPSG:4326`。读取响应时需要明确设置：

```text
dataProjection: EPSG:4326
featureProjection: EPSG:3857
```

`dataProjection` 表示服务器返回数据的坐标系，`featureProjection` 表示前端地图显示坐标系。只修改坐标系名称而不转换实际坐标，会导致要素错位或无法显示。

## WFS 与 WMS 的区别

| 对比项 | WMS | WFS |
| --- | --- | --- |
| 主要响应 | 地图图片 | 几何和属性要素 |
| 主要渲染位置 | GeoServer 服务端 | OpenLayers 浏览器端 |
| 前端能否直接读取属性 | 不能从图片直接读取 | 可以读取 Feature 属性 |
| 前端样式 | 通常由 GeoServer 样式决定 | 可以使用 OpenLayers Style 设置 |
| 典型用途 | 地图展示 | 查询、选择、分析和编辑 |

## 点击查询

前端使用 OpenLayers `Select` 交互选择 WFS 矢量要素。点击后从 Feature 中读取：

- `id`：测试表中的稳定编号；
- `name`：要素名称；
- `facility_type`、`road_level` 或 `zone_type`：不同图层的业务类型；
- `geometry.getType()`：Point、LineString 或 Polygon。

选中的点、线、面使用统一的红色高亮样式。点击空白位置或关闭 WFS 图层后清除选择结果。