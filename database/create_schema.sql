begin;

-- 启用 PostGIS 空间数据能力
create extension if not exists postgis;

-- 设施点，用于学习 WFS 查询和 WFS-T 点要素编辑
create table facilities (
      id bigint generated always as identity primary key,
      name varchar(100) not null,
      facility_type varchar(50) not null,
      description varchar(255),
      geom geometry(Point, 4326) not null
);

-- 演示道路，用于学习线要素发布和查询
create table demo_roads (
      id bigint generated always as identity primary key,
      name varchar(100) not null,
      road_level varchar(50) not null,
      geom geometry(LineString, 4326) not null
);

-- 演示区域，用于学习面要素发布和查询
create table demo_zones (
      id bigint generated always as identity primary key,
      name varchar(100) not null,
      zone_type varchar(50) not null,
      geom geometry(Polygon, 4326) not null
);

-- 为三张空间表建立 GiST 空间索引
create index facilities_geom_gix on facilities using gist (geom);
create index demo_roads_geom_gix on demo_roads using gist (geom);
create index demo_zones_geom_gix on demo_zones using gist (geom);

insert into facilities (name, facility_type, description, geom) values
      ('青岛站', 'transport', '青岛火车站测试点', ST_SetSRID(ST_MakePoint(120.3128, 36.0636), 4326)),
      ('五四广场', 'public_service', '青岛城市广场测试点', ST_SetSRID(ST_MakePoint(120.3846, 36.0662), 4326)),
      ('中山公园', 'park', '青岛中山公园测试点', ST_SetSRID(ST_MakePoint(120.3480, 36.0620), 4326));

insert into demo_roads (name, road_level, geom) values
      ('香港中路', 'secondary', ST_GeomFromText('LINESTRING(120.3720 36.0665, 120.3850 36.0665, 120.3980 36.0665)', 4326)),
      ('山东路', 'primary', ST_GeomFromText('LINESTRING(120.3770 36.0550, 120.3770 36.0700, 120.3770 36.0850)', 4326));

insert into demo_zones (name, zone_type, geom) values
      ('市南中心服务区', 'service', ST_GeomFromText('POLYGON((120.3700 36.0600, 120.3900 36.0600, 120.3900 36.0700, 120.3700 36.0700, 120.3700 36.0600))', 4326)),
      ('浮山湾休闲区', 'recreation', ST_GeomFromText('POLYGON((120.3800 36.0700, 120.4000 36.0700, 120.4000 36.0800, 120.3800 36.0800, 120.3800 36.0700))', 4326));

commit;