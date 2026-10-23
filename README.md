# OpenLayers OGC Lab

基于 Vue 3、TypeScript、OpenLayers、GeoServer 和 PostgreSQL/PostGIS 构建的二维 WebGIS 与 OGC 标准服务实验项目。

## 学习进度

#### OGC 服务

- WMS：设施点地图图像、TileWMS 与 GetFeatureInfo 点击查询
- WMTS：GeoWebCache、GetCapabilities、瓦片矩阵与 EPSG:900913
- WFS：点线面 GetFeature、BBOX 范围加载、GeoJSON 解析与属性查询
- WFS-T：设施点新增、修改、删除及事务响应校验
- WFS-T：道路和服务范围面的顶点拖拽与几何更新
- WFS-T：通过 Vite 代理和独立编辑账号保护写请求凭据
- WCS：青岛市南区 DEM Coverage 发布与 GetCoverage 请求
- WCS：GeoTIFF 原始高程值、NoData、客户端设色与空间定位修正
- WCS：使用 `WebGLTileLayer.getData()` 查询地图点击位置的实际高程

#### OpenLayers 交互

- OpenStreetMap 与地形底图切换
- WMS、WMTS、WFS 和 WCS 图层显示控制
- Select 点线面选择与 Overlay 属性弹窗
- Draw 设施点绘制
- Modify 点线面几何修改
- Snap 新增设施点道路吸附
- 测距、测面积与绘制过程实时提示
- EPSG:4326、EPSG:3857 与 CRS:84 坐标转换
- 编辑、测量、WFS选择、DEM查询和WMS查询的点击优先级管理

#### 矢量数据格式

- GeoJSON：FeatureCollection、geometry、properties 与客户端投影转换
- GML 3.2：WFS FeatureCollection、XML命名空间与GML几何解析
- KML：Placemark、ExtendedData、经纬度坐标与样式提取
- Shapefile：SHP、SHX、DBF、PRJ和CST配套文件
- Shapefile：WFS SHAPE-ZIP导出、UTF-8中文属性与DBF字段名截断验证

## 开发环境

- Vue 3
- TypeScript
- Vite
- OpenLayers 10.11.0
- GeoServer 2.28.2
- GeoWebCache
- PostgreSQL 14
- PostGIS 3.5
- Docker Compose

本地环境：Node.js v24.18.0、npm 11.16.0、Docker Compose v5.5.0。

## 运行

运行前在仓库根目录创建 `.env`：

```dotenv
POSTGRES_PASSWORD=本机数据库密码
GEOSERVER_ADMIN_USER=admin
GEOSERVER_ADMIN_PASSWORD=本机GeoServer管理员密码
WFS_EDITOR_USER=ogc_editor
WFS_EDITOR_PASSWORD=本机WFS编辑用户密码
```

常用命令：

- `docker compose up -d`：启动 PostGIS 和 GeoServer
- `docker compose ps`：查看容器状态
- `cd frontend`：进入前端目录
- `npm install`：安装前端依赖
- `npm run dev`：启动本地开发环境
- `npm run build`：检查类型并构建项目

本地入口：

- `http://localhost:5173/`：OGC 服务与地图交互主页面
- `http://localhost:5173/#/vector-formats`：矢量数据格式实验页面
- `http://localhost:18080/geoserver`：GeoServer 管理页面