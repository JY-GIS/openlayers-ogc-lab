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

## WFS-T 要素编辑

本项目使用 WFS 2.0.0 Transaction 对 `ogc_lab:facilities` 执行新增、修改和删除，并对 `ogc_lab:demo_roads`、`ogc_lab:demo_zones` 执行几何修改。前端通过 OpenLayers `WFS.writeTransaction()` 生成事务 XML，再由 GeoServer 将事务写入 PostGIS。

当前道路和服务范围面只修改几何形状，不修改名称、道路等级或区域类型等属性。

### 事务入口与认证

浏览器统一向 Vite 开发服务器的固定代理地址发送请求：

```text
POST /wfs-transaction
```

Vite 将请求转发到：

```text
http://localhost:18080/geoserver/ogc_lab/wfs
```

代理从仓库根目录 `.env` 读取以下配置，并在服务端代理阶段添加 HTTP Basic Authentication 请求头：

```dotenv
WFS_EDITOR_USER=ogc_editor
WFS_EDITOR_PASSWORD=本机设置的编辑用户密码
```

账号密码不会打包到浏览器 JavaScript 中。修改 `.env` 后必须重新启动 Vite，开发服务器才会读取新配置。

GeoServer 中需要存在已启用的 `ogc_editor` 用户，并为其分配 `ROLE_OGC_EDITOR`。该角色需要具备 `ogc_lab:facilities`、`ogc_lab:demo_roads` 和 `ogc_lab:demo_zones` 的写权限，不应使用管理员账号作为日常编辑账号。

### 事务公共参数

三个事务操作使用相同的 WFS 配置：

| 参数 | 值 | 用途 |
| --- | --- | --- |
| `version` | `2.0.0` | WFS 协议版本 |
| `featureNS` | `http://localhost/ogc_lab` | 工作区命名空间 URI |
| `featurePrefix` | `ogc_lab` | 工作区前缀 |
| `featureType` | `facilities`、`demo_roads` 或 `demo_zones` | 根据编辑目标动态指定要素类型 |
| `srsName` | `CRS:84` | 按经度、纬度顺序写入几何坐标 |

OpenLayers 地图上的临时要素使用 `EPSG:3857`。提交新增或修改前，前端会克隆几何并转换为 `CRS:84`，避免直接改变地图上的原始 Feature。

### 新增设施点

新增流程：

```text
点击“新增设施点”
  → Draw 绘制临时点
  → 填写名称、设施类型和描述
  → WFS Transaction Insert
  → GeoServer 写入 PostGIS
  → 读取 InsertResults 中的 Feature ID
  → refresh() 重新加载 WFS 图层
```

事务响应中的 `totalInserted` 必须为 `1`，否则前端将本次操作视为失败。

### 修改设施点

只有从 `facilities` 图层选中的 Point 要素可以进入修改状态。前端克隆服务器要素到草稿图层，通过 `Modify` 交互调整位置，并允许同时修改属性。

提交时使用服务器返回的 Feature ID（例如 `facilities.6`）生成 WFS Transaction Update。事务响应中的 `totalUpdated` 必须为 `1`。提交成功后清除草稿和选择状态，并重新加载服务器数据。

使用克隆要素可以保证：在 GeoServer 确认事务成功之前，WFS 图层中的原始要素不会被直接改变。

### 删除设施点

选中设施点后可以执行删除。前端先显示确认对话框，用户确认后使用该要素的 Feature ID 生成 WFS Transaction Delete。

删除流程：

```text
选择设施点
  → 点击“删除选中设施点”
  → 确认删除
  → WFS Transaction Delete
  → 检查 totalDeleted 是否为 1
  → 清除选择状态
  → refresh() 重新加载 WFS 图层
```

### 修改道路和服务范围面

道路和服务范围面使用 OpenLayers `Modify` 交互修改顶点。`Modify` 改变线或面的形状；它不同于移动整个要素的 `Translate`，本阶段没有实现整体平移。

线面修改流程：

```text
选择道路或服务范围面
  → clone() 创建草稿 Feature
  → 暂时隐藏服务器原始要素
  → 在黄色草稿上拖动顶点
  → 将草稿几何从 EPSG:3857 转换到 CRS:84
  → 根据要素类型生成 demo_roads 或 demo_zones 的 Update
  → 检查 totalUpdated 是否为 1
  → 清除草稿并 refresh() 重新加载 WFS 图层
```

前端通过 Feature ID 前缀和几何类型共同确定事务目标：

| Feature ID 前缀 | 几何类型 | WFS-T `featureType` |
| --- | --- | --- |
| `demo_roads.` | `LineString` | `demo_roads` |
| `demo_zones.` | `Polygon` | `demo_zones` |

提交使用的事务 Feature 只包含 `geom` 和原 Feature ID，因此 GeoServer 只更新几何字段，不会覆盖道路名称、道路等级或区域类型。提交失败时保留草稿和 `Modify` 交互，用户可以继续调整并重试；取消编辑则丢弃草稿并恢复服务器原始要素。
