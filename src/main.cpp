#include "VideoStreamer.h"
#include <crow.h>
#include <iostream>
#include <fstream>
#include <string>
#include <algorithm>
#include <chrono>
#include <thread>

using namespace std;

int main(int argc, char** argv) {
    // Create Crow app
    crow::SimpleApp app;
    
    // 设置路由和处理程序

    // Create video streamer
    VideoStreamer streamer;
    
    // 初始化摄像头 - 使用自动检测功能和640x480分辨率
    cout << "Detecting camera devices..." << endl;
    if (!streamer.initialize(-1, 640, 480, 30)) {
        cerr << "Failed to initialize camera" << endl;
        return -1;
    }

    // Start video stream
    streamer.start();

    // 保存所有WebSocket连接
    std::vector<crow::websocket::connection*> ws_connections;
    std::mutex ws_mutex;
    
    // 创建视频帧广播线程
    std::thread broadcast_thread([&]() {
        while (true) {
            // 获取视频帧
            cv::Mat frame;
            if (streamer.getFrame(frame)) {
                // 编码为JPEG
                std::vector<uchar> buffer;
                std::vector<int> params = {cv::IMWRITE_JPEG_QUALITY, 80};
                cv::imencode(".jpg", frame, buffer, params);
                
                // 广播给所有连接
                std::string binary_data(buffer.begin(), buffer.end());
                
                std::lock_guard<std::mutex> lock(ws_mutex);
                for (auto conn : ws_connections) {
                    if (conn) {
                        conn->send_binary(binary_data);
                    }
                }
            }
            
            // 控制帧率
            std::this_thread::sleep_for(std::chrono::milliseconds(33)); // ~30fps
        }
    });
    broadcast_thread.detach();
    
    // WebSocket endpoint
    CROW_ROUTE(app, "/ws")
    .websocket(&app)
    .onopen([&ws_connections, &ws_mutex](crow::websocket::connection& conn) {
        std::cout << "New WebSocket connection" << std::endl;
        std::lock_guard<std::mutex> lock(ws_mutex);
        ws_connections.push_back(&conn);
    })
    .onmessage([&streamer](crow::websocket::connection& conn, const std::string& data, bool is_binary) {
        // 处理来自客户端的消息
        if (!is_binary) {
            std::cout << "Received text message: " << data << std::endl;
            
            try {
                // 解析JSON消息
                std::string action;
                
                // 简单解析action字段
                size_t action_pos = data.find("\"action\":");
                if (action_pos != std::string::npos) {
                    size_t start = data.find("\"", action_pos + 9);
                    if (start != std::string::npos) {
                        size_t end = data.find("\"", start + 1);
                        if (end != std::string::npos) {
                            action = data.substr(start + 1, end - start - 1);
                        }
                    }
                }
                
                // 处理分辨率设置请求
                if (action == "set_resolution") {
                    int width = 640, height = 480; // 默认值
                    
                    // 解析width字段
                    size_t width_pos = data.find("\"width\":");
                    if (width_pos != std::string::npos) {
                        size_t start = width_pos + 8;
                        size_t end = data.find(",", start);
                        if (end == std::string::npos) end = data.find("}", start);
                        if (end != std::string::npos) {
                            std::string width_str = data.substr(start, end - start);
                            try {
                                width = std::stoi(width_str);
                            } catch (...) {
                                width = 640; // 默认值
                            }
                        }
                    }
                    
                    // 解析height字段
                    size_t height_pos = data.find("\"height\":");
                    if (height_pos != std::string::npos) {
                        size_t start = height_pos + 9;
                        size_t end = data.find(",", start);
                        if (end == std::string::npos) end = data.find("}", start);
                        if (end != std::string::npos) {
                            std::string height_str = data.substr(start, end - start);
                            try {
                                height = std::stoi(height_str);
                            } catch (...) {
                                height = 480; // 默认值
                            }
                        }
                    }
                    
                    std::cout << "Setting resolution to " << width << "x" << height << std::endl;
                    
                    // 设置新分辨率
                    if (streamer.setResolution(width, height)) {
                        // 发送成功响应
                        conn.send_text("{\"type\":\"resolution_changed\",\"width\":"
                                    + std::to_string(width) + ",\"height\":"
                                    + std::to_string(height) + "}");
                    } else {
                        // 发送错误响应
                        conn.send_text("{\"type\":\"error\",\"message\":\"Failed to set resolution\"}");
                    }
                }
                // 处理标定模式切换请求
                else if (action == "toggle_calibration_mode") {
                    // 切换标定模式
                    static bool calibration_mode = false;
                    calibration_mode = !calibration_mode;
                    
                    std::cout << "Calibration mode: " << (calibration_mode ? "ON" : "OFF") << std::endl;
                    
                    // 发送响应
                    conn.send_text("{\"type\":\"calibration_mode_changed\",\"enabled\":"
                                + std::string(calibration_mode ? "true" : "false") + "}");
                }
                // 添加标定点
                else if (action == "add_calibration_point") {
                    float img_x = 0, img_y = 0, ground_x = 0, ground_y = 0;
                    
                    // 解析图像坐标
                    size_t img_x_pos = data.find("\"img_x\":");
                    if (img_x_pos != std::string::npos) {
                        size_t start = img_x_pos + 8;
                        size_t end = data.find(",", start);
                        if (end != std::string::npos) {
                            std::string val_str = data.substr(start, end - start);
                            try { img_x = std::stof(val_str); } catch (...) {}
                        }
                    }
                    
                    size_t img_y_pos = data.find("\"img_y\":");
                    if (img_y_pos != std::string::npos) {
                        size_t start = img_y_pos + 8;
                        size_t end = data.find(",", start);
                        if (end != std::string::npos) {
                            std::string val_str = data.substr(start, end - start);
                            try { img_y = std::stof(val_str); } catch (...) {}
                        }
                    }
                    
                    // 解析地面坐标
                    size_t ground_x_pos = data.find("\"ground_x\":");
                    if (ground_x_pos != std::string::npos) {
                        size_t start = ground_x_pos + 11;
                        size_t end = data.find(",", start);
                        if (end != std::string::npos) {
                            std::string val_str = data.substr(start, end - start);
                            try { ground_x = std::stof(val_str); } catch (...) {}
                        }
                    }
                    
                    size_t ground_y_pos = data.find("\"ground_y\":");
                    if (ground_y_pos != std::string::npos) {
                        size_t start = ground_y_pos + 11;
                        size_t end = data.find("}", start);
                        if (end != std::string::npos) {
                            std::string val_str = data.substr(start, end - start);
                            try { ground_y = std::stof(val_str); } catch (...) {}
                        }
                    }
                    
                    std::cout << "Adding calibration point: Image(" << img_x << "," << img_y << ") -> Ground(" 
                              << ground_x << "," << ground_y << ")" << std::endl;
                    
                    // 添加标定点
                    if (streamer.addCalibrationPoint(cv::Point2f(img_x, img_y), cv::Point2f(ground_x, ground_y))) {
                        // 发送成功响应
                        conn.send_text("{\"type\":\"calibration_point_added\"}");
                    } else {
                        // 发送错误响应
                        conn.send_text("{\"type\":\"error\",\"message\":\"Failed to add calibration point\"}");
                    }
                }
                // 移除最后一个标定点
                else if (action == "remove_last_calibration_point") {
                    if (streamer.removeLastCalibrationPoint()) {
                        conn.send_text("{\"type\":\"calibration_point_removed\"}");
                    } else {
                        conn.send_text("{\"type\":\"error\",\"message\":\"No calibration points to remove\"}");
                    }
                }
                // 清除所有标定点
                else if (action == "clear_calibration_points") {
                    streamer.clearCalibrationPoints();
                    conn.send_text("{\"type\":\"calibration_points_cleared\"}");
                }
                // 计算单应性矩阵
                else if (action == "compute_homography") {
                    if (streamer.computeHomography()) {
                        // 获取单应性矩阵数据
                        cv::Mat homographyMatrix = streamer.getHomographyMatrix();
                        
                        if (!homographyMatrix.empty()) {
                            // 将矩阵转换为JSON格式的字符串
                            std::stringstream matrixJson;
                            matrixJson << "[";
                            for (int i = 0; i < homographyMatrix.rows; i++) {
                                for (int j = 0; j < homographyMatrix.cols; j++) {
                                    if (i > 0 || j > 0) matrixJson << ",";
                                    matrixJson << homographyMatrix.at<double>(i, j);
                                }
                            }
                            matrixJson << "]";
                            
                            // 发送标定结果消息，包含完整矩阵数据
                            conn.send_text("{\"type\":\"calibration_result\",\"success\":true,\"source\":\"manual\",\"homography_matrix\":"
                                        + matrixJson.str() + "}");
                        } else {
                            conn.send_text("{\"type\":\"calibration_result\",\"success\":true,\"source\":\"manual\"}");
                        }
                    } else {
                        conn.send_text("{\"type\":\"error\",\"message\":\"Failed to compute homography. Need at least 4 points.\"}");
                    }
                }
                // 从 ArUco 标记进行标定
                else if (action == "calibrate_from_aruco") {
                    if (streamer.calibrateFromArUcoMarkers()) {
                        // 获取单应性矩阵数据
                        cv::Mat homographyMatrix = streamer.getHomographyMatrix();
                        
                        if (!homographyMatrix.empty()) {
                            // 将矩阵转换为JSON格式的字符串
                            std::stringstream matrixJson;
                            matrixJson << "[";
                            for (int i = 0; i < homographyMatrix.rows; i++) {
                                for (int j = 0; j < homographyMatrix.cols; j++) {
                                    if (i > 0 || j > 0) matrixJson << ",";
                                    matrixJson << homographyMatrix.at<double>(i, j);
                                }
                            }
                            matrixJson << "]";
                            
                            // 发送标定结果消息，包含完整矩阵数据
                            conn.send_text("{\"type\":\"calibration_result\",\"success\":true,\"source\":\"aruco\",\"homography_matrix\":"
                                        + matrixJson.str() + "}");
                        } else {
                            conn.send_text("{\"type\":\"calibration_result\",\"success\":true,\"source\":\"aruco\"}");
                        }
                    } else {
                        conn.send_text("{\"type\":\"error\",\"message\":\"Failed to calibrate from ArUco markers. Need at least 4 markers with ground coordinates.\"}");
                    }
                }
                // 保存标定结果
                else if (action == "save_homography") {
                    std::string filename = "";
                    
                    // 解析文件名
                    size_t filename_pos = data.find("\"filename\":");
                    if (filename_pos != std::string::npos) {
                        size_t start = data.find("\"", filename_pos + 11);
                        if (start != std::string::npos) {
                            size_t end = data.find("\"", start + 1);
                            if (end != std::string::npos) {
                                filename = data.substr(start + 1, end - start - 1);
                            }
                        }
                    }
                    
                    if (streamer.saveHomography(filename)) {
                        conn.send_text("{\"type\":\"homography_saved\"}");
                    } else {
                        conn.send_text("{\"type\":\"error\",\"message\":\"Failed to save homography\"}");
                    }
                }
                // 加载标定结果
                else if (action == "load_homography") {
                    std::string filename = "";
                    
                    // 解析文件名
                    size_t filename_pos = data.find("\"filename\":");
                    if (filename_pos != std::string::npos) {
                        size_t start = data.find("\"", filename_pos + 11);
                        if (start != std::string::npos) {
                            size_t end = data.find("\"", start + 1);
                            if (end != std::string::npos) {
                                filename = data.substr(start + 1, end - start - 1);
                            }
                        }
                    }
                    
                    if (streamer.loadHomography(filename)) {
                        conn.send_text("{\"type\":\"homography_loaded\"}");
                    } else {
                        conn.send_text("{\"type\":\"error\",\"message\":\"Failed to load homography\"}");
                    }
                }
                // 图像坐标转地面坐标
                else if (action == "image_to_ground") {
                    float x = 0, y = 0;
                    
                    // 解析图像坐标
                    size_t x_pos = data.find("\"x\":");
                    if (x_pos != std::string::npos) {
                        size_t start = x_pos + 4;
                        size_t end = data.find(",", start);
                        if (end != std::string::npos) {
                            std::string val_str = data.substr(start, end - start);
                            try { x = std::stof(val_str); } catch (...) {}
                        }
                    }
                    
                    size_t y_pos = data.find("\"y\":");
                    if (y_pos != std::string::npos) {
                        size_t start = y_pos + 4;
                        size_t end = data.find("}", start);
                        if (end != std::string::npos) {
                            std::string val_str = data.substr(start, end - start);
                            try { y = std::stof(val_str); } catch (...) {}
                        }
                    }
                    
                    // 转换坐标
                    cv::Point2f groundPoint = streamer.imageToGround(cv::Point2f(x, y));
                    
                    // 发送响应
                    conn.send_text("{\"type\":\"ground_coordinates\",\"x\":"
                                + std::to_string(groundPoint.x) + ",\"y\":"
                                + std::to_string(groundPoint.y) + "}");
                } else if (action == "toggle_camera_calibration_mode") {
                    // 切换相机标定模式
                    bool mode = streamer.toggleCameraCalibrationMode();
                    
                    // 发送状态更新
                    std::string response = "{\"type\":\"camera_calibration_status\","
                                         "\"calibration_mode\":" + std::string(mode ? "true" : "false") + ","
                                         "\"calibrated\":" + std::string(streamer.isCameraCalibrated() ? "true" : "false") + "}";
                    conn.send_text(response);
                    
                } else if (action == "add_calibration_image") {
                    // 添加标定图像
                    bool success = streamer.addCalibrationImage();
                    
                    // 发送状态更新
                    std::string response = "{\"type\":\"camera_calibration_status\","
                                         "\"success\":" + std::string(success ? "true" : "false") + ","
                                         "\"image_count\":" + std::to_string(streamer.getCalibrationImageCount()) + "}";
                    conn.send_text(response);
                    
                } else if (action == "perform_camera_calibration") {
                    // 执行相机标定
                    bool success = streamer.performCameraCalibration();
                    double error = streamer.getCalibrationError();
                    
                    // 发送状态更新
                    std::string response = "{\"type\":\"camera_calibration_status\","
                                         "\"success\":" + std::string(success ? "true" : "false") + ","
                                         "\"calibrated\":" + std::string(streamer.isCameraCalibrated() ? "true" : "false") + ","
                                         "\"error\":" + std::to_string(error) + "}";
                    conn.send_text(response);
                    
                } else if (action == "save_camera_calibration") {
                    // 保存标定结果
                    bool success = streamer.saveCameraCalibration();
                    
                    // 发送状态更新
                    std::string response = "{\"type\":\"camera_calibration_status\","
                                         "\"save_success\":" + std::string(success ? "true" : "false") + "}";
                    conn.send_text(response);
                    
                } else if (action == "set_board_size") {
                    // 解析棋盘格参数
                    int width = 9, height = 6; // 默认值
                    float square_size = 0.025f; // 默认值 25mm
                    
                    // 解析width字段
                    size_t width_pos = data.find("\"width\":");
                    if (width_pos != std::string::npos) {
                        size_t start = width_pos + 8;
                        size_t end = data.find(",", start);
                        if (end != std::string::npos) {
                            width = std::stoi(data.substr(start, end - start));
                        }
                    }
                    
                    // 解析height字段
                    size_t height_pos = data.find("\"height\":");
                    if (height_pos != std::string::npos) {
                        size_t start = height_pos + 9;
                        size_t end = data.find(",", start);
                        if (end != std::string::npos) {
                            height = std::stoi(data.substr(start, end - start));
                        }
                    }
                    
                    // 解析square_size字段
                    size_t size_pos = data.find("\"square_size\":");
                    if (size_pos != std::string::npos) {
                        size_t start = size_pos + 14;
                        size_t end = data.find("}", start);
                        if (end != std::string::npos) {
                            square_size = std::stof(data.substr(start, end - start));
                        }
                    }
                    
                    // 设置棋盘格参数
                    streamer.setChessboardSize(width, height);
                    streamer.setSquareSize(square_size);
                    
                    // 发送确认消息
                    std::string response = "{\"type\":\"camera_calibration_status\","
                                         "\"board_size_set\":true,"
                                         "\"width\":" + std::to_string(width) + ","
                                         "\"height\":" + std::to_string(height) + ","
                                         "\"square_size\":" + std::to_string(square_size) + "}";
                    conn.send_text(response);
                }
            } catch (const std::exception& e) {
                std::cout << "Error processing message: " << e.what() << std::endl;
            }
        }
    })
    .onclose([&ws_connections, &ws_mutex](crow::websocket::connection& conn, const std::string& reason, uint16_t code) {
        std::cout << "WebSocket connection closed: " << reason << ", code: " << code << std::endl;
        std::lock_guard<std::mutex> lock(ws_mutex);
        ws_connections.erase(
            std::remove(ws_connections.begin(), ws_connections.end(), &conn),
            ws_connections.end());
    });

    // Serve static files
    CROW_ROUTE(app, "/")([]() {
        crow::response res;
        std::ifstream file("static/index.html");
        if(file.good()) {
            std::stringstream buffer;
            buffer << file.rdbuf();
            res.body = buffer.str();
            res.set_header("Content-Type", "text/html");
        } else {
            res.body = "<html><body><h1>Error: index.html not found</h1></body></html>";
            res.code = 404;
        }
        return res;
    });

    // Handle other static files
    CROW_ROUTE(app, "/<path>")([](const crow::request& req, crow::response& res, std::string path) {
        // Serve files from static directory
        if (path.empty()) {
            path = "index.html";
        }
        
        // Check file extension to set correct content type
        std::string ext = path.substr(path.find_last_of(".") + 1);
        std::string content_type = "text/plain";
        
        if (ext == "html") content_type = "text/html";
        else if (ext == "css") content_type = "text/css";
        else if (ext == "js") content_type = "application/javascript";
        else if (ext == "jpg" || ext == "jpeg") content_type = "image/jpeg";
        else if (ext == "png") content_type = "image/png";
        
        // Try to read the file
        std::ifstream file("static/" + path, std::ios::binary);
        if (!file.good()) {
            res.code = 404;
            res.body = "File not found";
            res.end();
            return;
        }
        
        // Read the file into a string
        std::stringstream buffer;
        buffer << file.rdbuf();
        
        res.code = 200;
        res.set_header("Content-Type", content_type);
        // 添加禁用缓存的 HTTP 头
        res.set_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
        res.set_header("Pragma", "no-cache");
        res.set_header("Expires", "0");
        res.body = buffer.str();
        res.end();
    });
    
    // 启动HTTP服务器
    cout << "Starting server on http://0.0.0.0:8080" << endl;
    app.port(8080).multithreaded().run();
    
    // 清理
    streamer.stop();
    
    return 0;
}
