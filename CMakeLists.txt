cmake_minimum_required(VERSION 3.10)
project(VideoMapping)

# 设置C++标准
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# 查找必要的包
find_package(OpenCV REQUIRED)
find_package(Crow REQUIRED)

# 包含目录
include_directories(
    ${CMAKE_CURRENT_SOURCE_DIR}/include
    ${OpenCV_INCLUDE_DIRS}
    ${Crow_INCLUDE_DIRS}
)

# 添加可执行文件
add_executable(video_mapping
    src/main.cpp
    src/VideoStreamer.cpp
    src/HomographyMapper.cpp
    src/CameraCalibrator.cpp
)

# 链接库
target_link_libraries(video_mapping
    PRIVATE
    ${OpenCV_LIBS}
    ${Crow_LIBRARIES}
    pthread
)

# 安装目标
install(TARGETS video_mapping DESTINATION bin)

# 安装静态文件
install(DIRECTORY static/ DESTINATION static)

# 复制静态文件到构建目录
file(COPY static/ DESTINATION ${CMAKE_BINARY_DIR}/static)
