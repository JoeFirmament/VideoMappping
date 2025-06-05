#include "VideoStreamer.h"
#include <crow.h> //微型 web 框架，支持 http 和 websocket，拍照，视频解压缩都用的这个框架。
#include <iostream>
#include <fstream>
#include <string>
#include <algorithm>
#include <chrono>
#include <thread>

using namespace std;

int main(int argc, char** argv) {
    // Create Crow app初始化一个 crow 应用
    crow::SimpleApp app;
    
    // 设置路由和处理程序

    // Create video streamer
    VideoStreamer streamer;
    
    // 初始化摄像头 
    // 这里 -1 表示自动检测使用第一个可用的摄像头设备，1920x1080 是分辨率，30 是帧率
    cout << "Detecting camera devices..." << endl;
    if (!streamer.initialize(-1, 1920, 1080, 30)) {
        cerr << "Failed to initialize camera" << endl;
        return -1;
    }

    // Start video stream
    streamer.start();

    // 保存所有WebSocket连接
    std::vector<crow::websocket::connection*> ws_connections;
    std::mutex ws_mutex;
    
    // 设置固定的显示分辨率以避免闪烁
    streamer.setDisplayResolution(960, 540);  // 固定为原始分辨率的一半
    
    // WebSocket endpoint
    CROW_ROUTE(app, "/ws")
    .websocket(&app)
    .onopen([&ws_connections, &ws_mutex, &streamer](crow::websocket::connection& conn) {
        std::cout << "New WebSocket connection" << std::endl;
        {
            std::lock_guard<std::mutex> lock(ws_mutex);
            ws_connections.push_back(&conn);
        }
        
        // 同时通知VideoStreamer有新连接
        streamer.handleWebSocket(crow::request{}, &conn);
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
                    bool currentMode = streamer.isCameraCalibrationMode();
                    bool newMode = !currentMode;
                    streamer.setCameraCalibrationMode(newMode);
                    
                    // 发送状态更新
                    std::string response = "{\"type\":\"camera_calibration_status\","
                                         "\"calibration_mode\":" + std::string(newMode ? "true" : "false") + ","
                                         "\"calibrated\":" + std::string(streamer.isCameraCalibrated() ? "true" : "false") + "}";
                    conn.send_text(response);
                    
                } else if (action == "add_calibration_image") {
                    // 添加标定图像
                    bool success = streamer.addCameraCalibrationImage();
                    
                    // 发送状态更新 - 包含完整的状态信息
                    std::string response = "{\"type\":\"camera_calibration_status\","
                                         "\"success\":" + std::string(success ? "true" : "false") + ","
                                         "\"calibration_mode\":" + std::string(streamer.isCameraCalibrationMode() ? "true" : "false") + ","
                                         "\"calibrated\":" + std::string(streamer.isCameraCalibrated() ? "true" : "false") + ","
                                         "\"image_count\":" + std::to_string(streamer.getCurrentSessionImageCount()) + ","
                                         "\"current_session_count\":" + std::to_string(streamer.getCurrentSessionImageCount()) + ","
                                         "\"saved_count\":" + std::to_string(streamer.getCalibrationImageCount()) + "}";
                    conn.send_text(response);
                    
                } else if (action == "perform_camera_calibration") {
                    // 执行相机标定
                    bool success = streamer.calibrateCamera();
                    double error = streamer.getCalibrationError();
                    
                    // 发送状态更新
                    std::string response = "{\"type\":\"camera_calibration_status\","
                                         "\"success\":" + std::string(success ? "true" : "false") + ","
                                         "\"calibrated\":" + std::string(streamer.isCameraCalibrated() ? "true" : "false") + ","
                                         "\"error\":" + std::to_string(error) + "}";
                    conn.send_text(response);
                    
                } else if (action == "load_camera_calibration") {
                    // 加载相机标定数据
                    std::string filename = "";
                    
                    // 解析文件名（可选）
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
                    
                    bool success = streamer.loadCameraCalibrationData(filename);
                    
                    if (success) {
                        // 获取加载的标定信息
                        cv::Mat cameraMatrix = streamer.getCameraMatrix();
                        cv::Mat distCoeffs = streamer.getDistCoeffs();
                        double error = streamer.getCalibrationError();
                        
                        // 构造详细的响应
                        std::stringstream response;
                        response << "{\"type\":\"camera_calibration_loaded\",";
                        response << "\"success\":true,";
                        response << "\"error\":" << std::fixed << std::setprecision(4) << error << ",";
                        
                        // 相机矩阵
                        if (!cameraMatrix.empty()) {
                            response << "\"camera_matrix\":[";
                            for (int i = 0; i < cameraMatrix.rows; i++) {
                                for (int j = 0; j < cameraMatrix.cols; j++) {
                                    if (i > 0 || j > 0) response << ",";
                                    response << std::fixed << std::setprecision(6) << cameraMatrix.at<double>(i, j);
                                }
                            }
                            response << "],";
                        }
                        
                        // 畸变系数
                        if (!distCoeffs.empty()) {
                            std::cout << "Distortion coefficients debug:" << std::endl;
                            std::cout << "  Matrix size: " << distCoeffs.rows << "x" << distCoeffs.cols << std::endl;
                            std::cout << "  Type: " << distCoeffs.type() << std::endl;
                            std::cout << "  Data: " << distCoeffs << std::endl;
                            
                            response << "\"distortion_coeffs\":[";
                            int totalElements = distCoeffs.rows * distCoeffs.cols;
                            for (int i = 0; i < totalElements; i++) {
                                if (i > 0) response << ",";
                                if (distCoeffs.rows == 1) {
                                    // 如果是行向量 (1xN)
                                    response << std::fixed << std::setprecision(6) << distCoeffs.at<double>(0, i);
                                } else {
                                    // 如果是列向量 (Nx1)
                                    response << std::fixed << std::setprecision(6) << distCoeffs.at<double>(i, 0);
                                }
                            }
                            response << "],";
                        }
                        
                        // 质量评估
                        std::string quality = "UNKNOWN";
                        if (error < 1.0) quality = "EXCELLENT";
                        else if (error < 2.0) quality = "GOOD";
                        else quality = "NEEDS_IMPROVEMENT";
                        
                        response << "\"quality\":\"" << quality << "\",";
                        response << "\"filepath\":\"" << (filename.empty() ? "/home/radxa/Qworkspace/VideoMapping/data/camera_calibration.xml" : filename) << "\"";
                        response << "}";
                        
                        conn.send_text(response.str());
                    } else {
                        std::string response = "{\"type\":\"camera_calibration_loaded\","
                                             "\"success\":false,"
                                             "\"error\":\"Failed to load calibration data\"}";
                        conn.send_text(response);
                    }
                    
                } else if (action == "save_camera_calibration") {
                    // 保存标定结果
                    bool success = streamer.saveCameraCalibrationData("");
                    
                    if (success) {
                        // 获取详细的标定信息
                        cv::Mat cameraMatrix = streamer.getCameraMatrix();
                        cv::Mat distCoeffs = streamer.getDistCoeffs();
                        double error = streamer.getCalibrationError();
                        size_t imageCount = streamer.getCalibrationImageCount();
                        
                        // 构造详细的响应
                        std::stringstream response;
                        response << "{\"type\":\"camera_calibration_saved\",";
                        response << "\"success\":true,";
                        response << "\"error\":" << std::fixed << std::setprecision(4) << error << ",";
                        response << "\"image_count\":" << imageCount << ",";
                        
                        // 相机矩阵
                        if (!cameraMatrix.empty()) {
                            response << "\"camera_matrix\":[";
                            for (int i = 0; i < cameraMatrix.rows; i++) {
                                for (int j = 0; j < cameraMatrix.cols; j++) {
                                    if (i > 0 || j > 0) response << ",";
                                    response << std::fixed << std::setprecision(6) << cameraMatrix.at<double>(i, j);
                                }
                            }
                            response << "],";
                        }
                        
                        // 畸变系数
                        if (!distCoeffs.empty()) {
                            std::cout << "Distortion coefficients debug:" << std::endl;
                            std::cout << "  Matrix size: " << distCoeffs.rows << "x" << distCoeffs.cols << std::endl;
                            std::cout << "  Type: " << distCoeffs.type() << std::endl;
                            std::cout << "  Data: " << distCoeffs << std::endl;
                            
                            response << "\"distortion_coeffs\":[";
                            int totalElements = distCoeffs.rows * distCoeffs.cols;
                            for (int i = 0; i < totalElements; i++) {
                                if (i > 0) response << ",";
                                if (distCoeffs.rows == 1) {
                                    // 如果是行向量 (1xN)
                                    response << std::fixed << std::setprecision(6) << distCoeffs.at<double>(0, i);
                                } else {
                                    // 如果是列向量 (Nx1)
                                    response << std::fixed << std::setprecision(6) << distCoeffs.at<double>(i, 0);
                                }
                            }
                            response << "],";
                        }
                        
                        // 质量评估
                        std::string quality = "UNKNOWN";
                        if (error < 1.0) quality = "EXCELLENT";
                        else if (error < 2.0) quality = "GOOD";
                        else quality = "NEEDS_IMPROVEMENT";
                        
                        response << "\"quality\":\"" << quality << "\",";
                        response << "\"filepath\":\"/home/radxa/Qworkspace/VideoMapping/data/camera_calibration.xml\"";
                        response << "}";
                        
                        conn.send_text(response.str());
                    } else {
                        std::string response = "{\"type\":\"camera_calibration_saved\","
                                             "\"success\":false,"
                                             "\"error\":\"Failed to save calibration data\"}";
                        conn.send_text(response);
                    }
                    
                } else if (action == "get_calibration_status") {
                    // 返回当前标定状态
                    std::string response = "{\"type\":\"camera_calibration_status\","
                                         "\"calibration_mode\":" + std::string(streamer.isCameraCalibrationMode() ? "true" : "false") + ","
                                         "\"calibrated\":" + std::string(streamer.isCameraCalibrated() ? "true" : "false") + ","
                                         "\"image_count\":" + std::to_string(streamer.getCurrentSessionImageCount()) + ","
                                         "\"current_session_count\":" + std::to_string(streamer.getCurrentSessionImageCount()) + ","
                                         "\"error\":" + std::to_string(streamer.getCalibrationError()) + ","
                                         "\"status_refresh\": true}";
                    conn.send_text(response);
                    
                } else if (action == "toggle_camera_correction") {
                    // 切换相机校正状态
                    bool enabled = false;
                    
                    // 解析enabled字段
                    size_t enabled_pos = data.find("\"enabled\":");
                    if (enabled_pos != std::string::npos) {
                        size_t value_start = enabled_pos + 10;
                        if (data.substr(value_start, 4) == "true") {
                            enabled = true;
                        }
                    }
                    
                    std::cout << "📸 [CAMERA CORRECTION] Toggling to: " << (enabled ? "enabled" : "disabled") << std::endl;
                    
                    // 检查是否有可用的标定数据
                    bool hasCalibration = streamer.isCameraCalibrated();
                    
                    if (enabled && !hasCalibration) {
                        // 如果要启用校正但没有标定数据
                        std::string response = "{\"type\":\"camera_correction_toggled\","
                                             "\"success\":false,"
                                             "\"enabled\":false,"
                                             "\"error\":\"No calibration data available. Please load or perform camera calibration first.\"}";
                        conn.send_text(response);
                    } else {
                        // 设置校正状态
                        streamer.setCameraCorrectionEnabled(enabled);
                        
                        std::string response = "{\"type\":\"camera_correction_toggled\","
                                             "\"success\":true,"
                                             "\"enabled\":" + std::string(enabled ? "true" : "false") + "}";
                        conn.send_text(response);
                        
                        std::cout << "✅ [CAMERA CORRECTION] Successfully " << (enabled ? "enabled" : "disabled") << std::endl;
                    }
                    
                } else if (action == "start_new_calibration_session") {
                    // 开始新的标定会话
                    streamer.startNewCameraCalibrationSession();
                    
                    std::string response = "{\"type\":\"camera_calibration_status\","
                                         "\"calibration_mode\":" + std::string(streamer.isCameraCalibrationMode() ? "true" : "false") + ","
                                         "\"calibrated\":" + std::string(streamer.isCameraCalibrated() ? "true" : "false") + ","
                                         "\"image_count\":" + std::to_string(streamer.getCurrentSessionImageCount()) + ","
                                         "\"current_session_count\":" + std::to_string(streamer.getCurrentSessionImageCount()) + ","
                                         "\"error\":" + std::to_string(streamer.getCalibrationError()) + ","
                                         "\"session_message\":\"New calibration session started\"}";
                    conn.send_text(response);
                    
                } else if (action == "clear_current_session") {
                    // 清除当前会话
                    streamer.clearCurrentCameraCalibrationSession();
                    
                    std::string response = "{\"type\":\"camera_calibration_status\","
                                         "\"calibration_mode\":" + std::string(streamer.isCameraCalibrationMode() ? "true" : "false") + ","
                                         "\"calibrated\":false,"
                                         "\"image_count\":0,"
                                         "\"current_session_count\":0,"
                                         "\"error\":0.0,"
                                         "\"session_message\":\"Current session cleared\"}";
                    conn.send_text(response);
                    
                } else if (action == "start_auto_calibration_capture") {
                    // 解析参数
                    int duration = 10; // 默认10秒
                    int interval = 500; // 默认500毫秒
                    
                    // 解析duration字段
                    size_t duration_pos = data.find("\"duration\":");
                    if (duration_pos != std::string::npos) {
                        size_t start = duration_pos + 11;
                        size_t end = data.find(",", start);
                        if (end == std::string::npos) end = data.find("}", start);
                        if (end != std::string::npos) {
                            std::string duration_str = data.substr(start, end - start);
                            try {
                                duration = std::stoi(duration_str);
                            } catch (...) {
                                duration = 10; // 默认值
                            }
                        }
                    }
                    
                    // 解析interval字段
                    size_t interval_pos = data.find("\"interval\":");
                    if (interval_pos != std::string::npos) {
                        size_t start = interval_pos + 11;
                        size_t end = data.find(",", start);
                        if (end == std::string::npos) end = data.find("}", start);
                        if (end != std::string::npos) {
                            std::string interval_str = data.substr(start, end - start);
                            try {
                                interval = std::stoi(interval_str);
                            } catch (...) {
                                interval = 500; // 默认值
                            }
                        }
                    }
                    
                    // 自动采集前先开始新的标定会话
                    streamer.startNewCameraCalibrationSession();
                    
                    // 启动自动采集
                    bool success = streamer.startAutoCalibrationCapture(duration, interval);
                    
                    // 发送状态更新
                    std::string response = "{\"type\":\"auto_capture_started\","
                                         "\"success\":" + std::string(success ? "true" : "false") + ","
                                         "\"duration\":" + std::to_string(duration) + ","
                                         "\"interval\":" + std::to_string(interval) + "}";
                    conn.send_text(response);
                    
                } else if (action == "stop_auto_calibration_capture") {
                    // 停止自动采集
                    bool success = streamer.stopAutoCalibrationCapture();
                    
                    // 发送状态更新
                    std::string response = "{\"type\":\"auto_capture_status\","
                                         "\"stopped\":" + std::string(success ? "true" : "false") + "}";
                    conn.send_text(response);
                    
                } else if (action == "set_board_size") {
                    // 解析棋盘格参数
                    int width = 8, height = 5; // 默认值
                    float square_size = 0.030f; // 默认值 30mm
                    int blur_kernel_size = 5; // 默认值 5x5核
                    
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
                        size_t end = data.find(",", start);
                        if (end == std::string::npos) end = data.find("}", start);
                        if (end != std::string::npos) {
                            square_size = std::stof(data.substr(start, end - start));
                        }
                    }
                    
                    // 解析blur_kernel_size字段
                    size_t blur_pos = data.find("\"blur_kernel_size\":");
                    if (blur_pos != std::string::npos) {
                        size_t start = blur_pos + 19;
                        size_t end = data.find("}", start);
                        if (end != std::string::npos) {
                            blur_kernel_size = std::stoi(data.substr(start, end - start));
                        }
                    }
                    
                    // 解析quality_check_level字段
                    int quality_check_level = 1; // 默认为平衡模式
                    size_t quality_pos = data.find("\"quality_check_level\":");
                    if (quality_pos != std::string::npos) {
                        size_t start = quality_pos + 22;
                        size_t end = data.find("}", start);
                        if (end == std::string::npos) end = data.find(",", start);
                        if (end != std::string::npos) {
                            quality_check_level = std::stoi(data.substr(start, end - start));
                        }
                    }
                    
                    // 设置棋盘格参数
                    streamer.setChessboardSize(width, height);
                    streamer.setSquareSize(square_size);
                    streamer.setBlurKernelSize(blur_kernel_size);
                    streamer.setQualityCheckLevel(quality_check_level);
                    
                    std::cout << "Set parameters: " << width << "x" << height 
                              << ", square_size: " << square_size 
                              << ", blur_kernel: " << blur_kernel_size 
                              << ", quality_level: " << quality_check_level << std::endl;
                    
                    // 发送确认消息
                    std::string response = "{\"type\":\"camera_calibration_status\","
                                         "\"board_size_set\":true,"
                                         "\"width\":" + std::to_string(width) + ","
                                         "\"height\":" + std::to_string(height) + ","
                                         "\"square_size\":" + std::to_string(square_size) + ","
                                         "\"blur_kernel_size\":" + std::to_string(blur_kernel_size) + "}";
                    conn.send_text(response);
                }
            } catch (const std::exception& e) {
                std::cout << "Error processing message: " << e.what() << std::endl;
            }
        }
    })
    .onclose([&ws_connections, &ws_mutex, &streamer](crow::websocket::connection& conn, const std::string& reason, uint16_t code) {
        std::cout << "WebSocket connection closed: " << reason << ", code: " << code << std::endl;
        {
            std::lock_guard<std::mutex> lock(ws_mutex);
            ws_connections.erase(
                std::remove(ws_connections.begin(), ws_connections.end(), &conn),
                ws_connections.end());
        }
        
        // 同时通知VideoStreamer连接已关闭
        streamer.removeWebSocketConnection(&conn);
    });

    // 添加一个测试JavaScript路由
    CROW_ROUTE(app, "/test.js")([]() {
        crow::response res;
        res.set_header("Content-Type", "application/javascript; charset=utf-8");
        res.set_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
        res.set_header("Pragma", "no-cache");
        res.set_header("Expires", "0");
        res.body = R"(
console.log('Test JavaScript loaded!');
console.log('Current time:', new Date().toISOString());
alert('Test JavaScript is working!');
)";
        return res;
    });

    // Serve static files
    CROW_ROUTE(app, "/")([]() {
        crow::response res;
        std::ifstream file("static/index.html");
        if(file.good()) {
            std::stringstream buffer;
            buffer << file.rdbuf();
            res.body = buffer.str();
            res.set_header("Content-Type", "text/html; charset=utf-8");
            // 添加禁用缓存的 HTTP 头
            res.set_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
            res.set_header("Pragma", "no-cache");
            res.set_header("Expires", "0");
            res.set_header("ETag", "");
            res.set_header("Last-Modified", "");
        } else {
            res.body = "<html><body><h1>Error: index.html not found</h1></body></html>";
            res.code = 404;
        }
        return res;
    });

    // Handle other static files
    CROW_ROUTE(app, "/<path>")([](const crow::request& req, crow::response& res, std::string path) {
        // 记录请求的文件路径
        std::cout << "Static file request: " << path << std::endl;
        
        // Serve files from static directory
        if (path.empty()) {
            path = "index.html";
        }
        
        // Check file extension to set correct content type
        std::string ext = path.substr(path.find_last_of(".") + 1);
        std::string content_type = "text/plain";
        
        if (ext == "html") content_type = "text/html";
        else if (ext == "css") content_type = "text/css";
        else if (ext == "js") content_type = "application/javascript; charset=utf-8";
        else if (ext == "jpg" || ext == "jpeg") content_type = "image/jpeg";
        else if (ext == "png") content_type = "image/png";
        
        // Try to read the file
        std::string full_path = "static/" + path;
        std::cout << "Trying to read file: " << full_path << std::endl;
        
        std::ifstream file(full_path, std::ios::binary);
        if (!file.good()) {
            std::cout << "File not found: " << full_path << std::endl;
            res.code = 404;
            res.body = "File not found";
            res.end();
            return;
        }
        
        // Read the file into a string
        std::stringstream buffer;
        buffer << file.rdbuf();
        
        std::cout << "File loaded successfully, size: " << buffer.str().length() << " bytes" << std::endl;
        
        res.code = 200;
        res.set_header("Content-Type", content_type);
        // 添加禁用缓存的 HTTP 头
        res.set_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
        res.set_header("Pragma", "no-cache");
        res.set_header("Expires", "0");
        res.set_header("ETag", "");
        res.set_header("Last-Modified", "");
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
