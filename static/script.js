console.log('Script.js loaded!');
console.log('Document readyState:', document.readyState);

class VideoStream {
    constructor() {
        console.log('VideoStream constructor called');
        
        // Basic elements
        this.video = document.getElementById('video');
        this.statusElement = document.getElementById('status');
        this.fpsElement = document.getElementById('fps');
        this.resolutionElement = document.getElementById('resolution');
        this.latencyElement = document.getElementById('latency');
        this.startBtn = document.getElementById('startBtn');
        this.stopBtn = document.getElementById('stopBtn');
        // this.fullscreenBtn = document.getElementById('fullscreenBtn');
        
        // Debug related elements
        this.debugToggle = document.getElementById('debugToggle');
        this.debugInfo = document.getElementById('debugInfo');
        this.homographyMatrix = document.getElementById('homographyMatrix');
        this.lastOperation = document.getElementById('lastOperation');
        this.detectedMarkersCount = document.getElementById('detectedMarkersCount');
        this.exportMatrixBtn = document.getElementById('exportMatrixBtn');
        
        // Camera calibration related elements
        this.toggleCameraCalibrationBtn = document.getElementById('toggleCameraCalibrationBtn');
        this.addCalibrationImageBtn = document.getElementById('addCalibrationImageBtn');
        this.performCameraCalibrationBtn = document.getElementById('performCameraCalibrationBtn');
        this.saveCameraCalibrationBtn = document.getElementById('saveCameraCalibrationBtn');
        this.loadCameraCalibrationBtn = document.getElementById('loadCameraCalibrationBtn');
        this.boardWidthInput = document.getElementById('boardWidthInput');
        this.boardHeightInput = document.getElementById('boardHeightInput');
        this.squareSizeInput = document.getElementById('squareSizeInput');
        this.setBoardSizeBtn = document.getElementById('setBoardSizeBtn');
        this.blurKernelSizeInput = document.getElementById('blurKernelSizeInput');
        this.qualityCheckLevelInput = document.getElementById('qualityCheckLevelInput');
        this.calibrationErrorDisplay = document.getElementById('calibrationErrorDisplay');
        this.savedImagesCount = document.getElementById('savedImagesCount');
        this.currentSessionImagesCount = document.getElementById('currentSessionImagesCount');
        
        // Session management buttons

        
        // Automatic capture related elements
        this.autoCaptureTimeInput = document.getElementById('autoCaptureTimeInput');
        this.autoCaptureIntervalInput = document.getElementById('autoCaptureIntervalInput');
        this.startAutoCalibrationBtn = document.getElementById('startAutoCalibrationBtn');
        this.stopAutoCalibrationBtn = document.getElementById('stopAutoCalibrationBtn');
        
        // Countdown display elements
        this.countdownDisplay = document.getElementById('countdownDisplay');
        this.remainingTime = document.getElementById('remainingTime');
        this.nextCaptureTime = document.getElementById('nextCaptureTime');
        this.captureProgress = document.getElementById('captureProgress');
        
        // 倒计时相关变量
        this.countdownInterval = null;
        this.countdownStartTime = null;
        this.countdownDuration = null;
        this.countdownIntervalMs = null;
        this.lastCaptureTime = null;
        
        // 添加新的分辨率显示元素
        this.displayResolution = document.getElementById('displayResolution');
        this.detectionResolution = document.getElementById('detectionResolution');
        this.performanceMode = document.getElementById('performanceMode');
        
        // Initialize variables
        this.ws = null;
        this.connected = false;
        this.frameCount = 0;
        this.lastFrameCount = 0;
        this.lastFrameTime = 0;
        this.frameTimes = [];
        this.fps = 0;
        this.latency = 0;
        this.calibrationMode = false;
        this.calibrated = false;
        this.arucoMode = false;
        this.calibrationPoints = [];
        this.markerCoordinates = {};
        this.rawHomographyMatrix = null;
        
        // 调试模式 - 设置为 false 减少日志输出
        this.debugMode = false;
        
        // 添加快捷键支持 (Ctrl+Shift+D 切换调试模式)
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.shiftKey && e.key === 'D') {
                this.debugMode = !this.debugMode;
                console.log(`🔧 [DEBUG] Debug mode ${this.debugMode ? 'ENABLED' : 'DISABLED'} (Ctrl+Shift+D)`);
                if (this.debugToggle) {
                    this.debugToggle.checked = this.debugMode;
                    if (this.debugInfo) {
                        this.debugInfo.style.display = this.debugMode ? 'block' : 'none';
                    }
                }
            }
            // 添加全屏快捷键支持
            else if (e.key === 'F11') {
                e.preventDefault();
                this.toggleFullscreen();
                console.log('🖥️ [FULLSCREEN] F11 快捷键触发全屏切换');
            }
            // ESC 键退出全屏
            else if (e.key === 'Escape' && document.fullscreenElement) {
                document.exitFullscreen();
                console.log('🖥️ [FULLSCREEN] ESC 键退出全屏');
            }
        });
        
        // Camera calibration related status
        this.cameraCalibrationMode = false;
        this.cameraCalibrated = false;
        this.calibrationImages = 0;
        this.currentSessionImages = 0;
        
        // Auto capture countdown related
        this.autoCaptureStartTime = null;
        this.autoCaptureEndTime = null;
        this.autoCaptureIntervalMs = 500;
        
        // Media display related
        this.currentBlobUrl = null;
        
        // Initialize
        this.initialize();
    }
    
    initialize() {
        // Bind methods to current instance
        if (this.toggleCameraCalibrationMode) {
            this.toggleCameraCalibrationMode = this.toggleCameraCalibrationMode.bind(this);
        }
        
        this.setupEventListeners();
        this.setupFullscreenListener();
        this.connect();
        
        // 初始化按钮状态 - 确保自动采集按钮在标定模式关闭时被禁用
        if (this.updateCameraCalibrationUIWithStates) {
            this.updateCameraCalibrationUIWithStates();
        }
        
        // Start FPS counter
        setInterval(() => this.updateFps(), 1000);
    }
    
    setupEventListeners() {
        // Start button
        if (this.startBtn) {
            this.startBtn.addEventListener('click', () => {
                this.start();
            });
        }
        
        // Stop button
        if (this.stopBtn) {
            this.stopBtn.addEventListener('click', () => {
                this.stop();
            });
        }
        
        // Fullscreen button
        // if (this.fullscreenBtn) {
        //     this.fullscreenBtn.addEventListener('click', () => {
        //         this.toggleFullscreen();
        //     });
        // }
        
        // Debug information switch
        if (this.debugToggle) {
            this.debugToggle.addEventListener('change', () => {
                if (this.debugInfo) {
                    this.debugInfo.style.display = this.debugToggle.checked ? 'block' : 'none';
                }
                // 同时控制调试模式日志输出
                this.debugMode = this.debugToggle.checked;
                console.log(`🔧 [DEBUG] Debug mode ${this.debugMode ? 'ENABLED' : 'DISABLED'}`);
            });
        }
        
        // Export matrix button
        if (this.exportMatrixBtn) {
            this.exportMatrixBtn.addEventListener('click', () => {
                this.exportHomographyMatrix();
            });
        }
        
        // Download camera calibration button
        this.downloadCameraCalibrationBtn = document.getElementById('downloadCameraCalibrationBtn');
        if (this.downloadCameraCalibrationBtn) {
            this.downloadCameraCalibrationBtn.addEventListener('click', () => {
                this.downloadCameraCalibration();
            });
        }
        
        // Download homography calibration button
        this.downloadHomographyCalibrationBtn = document.getElementById('downloadHomographyCalibrationBtn');
        if (this.downloadHomographyCalibrationBtn) {
            this.downloadHomographyCalibrationBtn.addEventListener('click', () => {
                this.downloadHomographyCalibration();
            });
        }
        
        // Camera calibration related event listeners
        if (this.toggleCameraCalibrationBtn) {
            this.toggleCameraCalibrationBtn.addEventListener('click', () => {
                this.toggleCameraCalibrationMode();
            });
        }
        
        if (this.addCalibrationImageBtn) {
            this.addCalibrationImageBtn.addEventListener('click', () => {
                this.addCalibrationImage();
            });
        }
        
        if (this.performCameraCalibrationBtn) {
            this.performCameraCalibrationBtn.addEventListener('click', () => {
                this.performCameraCalibration();
            });
        }
        
        if (this.saveCameraCalibrationBtn) {
            this.saveCameraCalibrationBtn.addEventListener('click', () => {
                this.saveCameraCalibration();
            });
        }
        
        if (this.loadCameraCalibrationBtn) {
            this.loadCameraCalibrationBtn.addEventListener('click', () => {
                this.loadCameraCalibration();
            });
        }
        
        if (this.setBoardSizeBtn) {
            this.setBoardSizeBtn.addEventListener('click', () => {
                this.setBoardSize();
            });
        }
        
        // Auto capture related event listeners
        if (this.startAutoCalibrationBtn) {
            this.startAutoCalibrationBtn.addEventListener('click', () => {
                this.startAutoCalibrationCapture();
            });
        }
        
        if (this.stopAutoCalibrationBtn) {
            this.stopAutoCalibrationBtn.addEventListener('click', () => {
                this.stopAutoCalibrationCapture();
            });
        }
        
        // Session management event listeners


        // 绑定相机校正开关事件
        this.enableCameraCorrectionToggle = document.getElementById('enableCameraCorrectionToggle');
        this.correctionStatus = document.getElementById('correctionStatus');
        
        if (this.enableCameraCorrectionToggle) {
            this.enableCameraCorrectionToggle.addEventListener('change', (e) => {
                this.toggleCameraCorrection(e.target.checked);
            });
        }
        
        // 添加浮动面板相关元素和事件
        this.floatingCorrectionPanel = document.getElementById('floatingCorrectionPanel');
        this.showCorrectionPanelBtn = document.getElementById('showCorrectionPanelBtn');
        this.closeCorrectionPanel = document.getElementById('closeCorrectionPanel');
        this.floatingEnableCameraCorrectionToggle = document.getElementById('floatingEnableCameraCorrectionToggle');
        this.floatingCorrectionStatus = document.getElementById('floatingCorrectionStatus');
        this.correctionEffectDisplay = document.getElementById('correctionEffectDisplay');
        this.correctionLatency = document.getElementById('correctionLatency');
        
        // 绑定浮动面板事件
        if (this.showCorrectionPanelBtn) {
            this.showCorrectionPanelBtn.addEventListener('click', () => {
                this.showFloatingCorrectionPanel();
            });
        }
        
        if (this.closeCorrectionPanel) {
            this.closeCorrectionPanel.addEventListener('click', () => {
                this.hideFloatingCorrectionPanel();
            });
        }
        
        if (this.floatingEnableCameraCorrectionToggle) {
            this.floatingEnableCameraCorrectionToggle.addEventListener('change', (e) => {
                this.toggleCameraCorrection(e.target.checked);
            });
        }
        
        // 绑定全屏按钮事件（更新后的版本）
        // if (this.fullscreenBtn) {
        //     this.fullscreenBtn.addEventListener('click', () => {
        //         this.toggleFullscreen();
        //     });
        // }

        // ArUco相关事件监听器
        this.toggleArUcoBtn = document.getElementById('toggleArUcoBtn');
        this.calibrateFromArUcoBtn = document.getElementById('calibrateFromArUcoBtn');
        this.saveMarkerCoordsBtn = document.getElementById('saveMarkerCoordsBtn');
        this.loadMarkerCoordsBtn = document.getElementById('loadMarkerCoordsBtn');
        this.setMarkerCoordBtn = document.getElementById('setMarkerCoordBtn');

        if (this.toggleArUcoBtn) {
            this.toggleArUcoBtn.addEventListener('click', () => {
                this.toggleArUcoMode();
            });
        }

        if (this.calibrateFromArUcoBtn) {
            this.calibrateFromArUcoBtn.addEventListener('click', () => {
                this.calibrateFromArUcoMarkers();
            });
        }

        if (this.saveMarkerCoordsBtn) {
            this.saveMarkerCoordsBtn.addEventListener('click', () => {
                this.saveMarkerCoordinates();
            });
        }

        if (this.loadMarkerCoordsBtn) {
            this.loadMarkerCoordsBtn.addEventListener('click', () => {
                this.loadMarkerCoordinates();
            });
        }

        if (this.setMarkerCoordBtn) {
            this.setMarkerCoordBtn.addEventListener('click', () => {
                this.setMarkerCoordinates();
            });
        }

        // ArUco 相关按钮事件绑定
        const setMarkerCoordBtn = document.getElementById('setMarkerCoordBtn');
        if (setMarkerCoordBtn) {
            setMarkerCoordBtn.addEventListener('click', () => this.setMarkerCoordinates());
        }

        // 新的内联标记坐标设置按钮
        const setMarkerCoordInlineBtn = document.getElementById('setMarkerCoordInlineBtn');
        if (setMarkerCoordInlineBtn) {
            setMarkerCoordInlineBtn.addEventListener('click', () => this.setMarkerCoordinatesInline());
        }

        // ArUco 检测参数设置按钮事件绑定
                const applyQuickSettingsBtn = document.getElementById('applyQuickSettingsBtn');
        if (applyQuickSettingsBtn) {
            applyQuickSettingsBtn.addEventListener('click', () => this.applyQuickArUcoSettings());
        }

        // 坐标变换标定相关事件监听器
        this.toggleCalibrationBtn = document.getElementById('toggleCalibrationBtn');
        this.computeHomographyBtn = document.getElementById('computeHomographyBtn');
        this.removeLastPointBtn = document.getElementById('removeLastPointBtn');
        this.clearPointsBtn = document.getElementById('clearPointsBtn');
        this.saveCalibrationBtn = document.getElementById('saveCalibrationBtn');
        this.loadCalibrationBtn = document.getElementById('loadCalibrationBtn');
        
        // 标定专用全屏按钮
        this.calibrationFullscreenBtn = document.getElementById('calibrationFullscreenBtn');

        if (this.toggleCalibrationBtn) {
            this.toggleCalibrationBtn.addEventListener('click', () => {
                this.toggleCoordinateCalibrationMode();
            });
        }

        if (this.computeHomographyBtn) {
            this.computeHomographyBtn.addEventListener('click', () => {
                this.computeHomographyMatrix();
            });
        }

        if (this.removeLastPointBtn) {
            this.removeLastPointBtn.addEventListener('click', () => {
                this.removeLastCalibrationPoint();
            });
        }

        if (this.clearPointsBtn) {
            this.clearPointsBtn.addEventListener('click', () => {
                this.clearCalibrationPoints();
            });
        }

        if (this.saveCalibrationBtn) {
            this.saveCalibrationBtn.addEventListener('click', () => {
                this.saveHomographyCalibration();
            });
        }

        if (this.loadCalibrationBtn) {
            this.loadCalibrationBtn.addEventListener('click', () => {
                this.loadHomographyCalibration();
            });
        }

        // 标定专用全屏按钮事件
        if (this.calibrationFullscreenBtn) {
            this.calibrationFullscreenBtn.addEventListener('click', () => {
                this.toggleCalibrationFullscreen();
            });
        }

        // 视频容器点击事件（用于添加标定点）
        this.videoContainer = document.querySelector('.video-container');
        this.videoElement = document.getElementById('video');
        
        if (this.videoElement) {
            this.videoElement.addEventListener('click', (e) => {
                this.handleVideoImageClick(e);
            });
        }
        
        // 保留容器点击作为备用
        if (this.videoContainer) {
            this.videoContainer.addEventListener('click', (e) => {
                // 如果点击的不是图像本身，则忽略
                if (e.target !== this.videoElement) {
                    this.handleVideoContainerClick(e);
                }
            });
        }

        // 操作指南面板事件绑定
        const closeGuideBtn = document.getElementById('closeGuideBtn');
        if (closeGuideBtn) {
            closeGuideBtn.addEventListener('click', () => this.hideOperationGuide());
        }

        // 初始显示操作指南（可选）
        this.showOperationGuide();

        // ArUco测试验证相关事件监听器已在上方绑定，无需重复绑定
    }
    
    connect() {
        // Create WebSocket connection
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        
        console.log('Attempting to connect WebSocket:', wsUrl);
        console.log('Current location:', window.location);
        
        this.updateStatus('connecting', 'Connecting WebSocket...');
        
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
            console.log('✅ [WEBSOCKET] Connection established successfully');
            this.connected = true;
            this.updateStatus('connected', window.i18n ? window.i18n.t('connected') : 'Connected');
            this.startBtn.disabled = false;
            this.stopBtn.disabled = true;
            
            // 连接成功后立即请求当前标定状态
            console.log('📋 [STATUS] Requesting current calibration status...');
            this.requestCurrentStatus();
            
            // 再次在500ms后请求状态，确保同步
            setTimeout(() => {
                if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                    console.log('📋 [STATUS] Requesting status again (sync check)...');
                    this.requestCurrentStatus();
                }
            }, 500);
        };
        
        this.ws.onclose = (event) => {
            console.log('❌ [WEBSOCKET] Connection closed - Code:', event.code, 'Reason:', event.reason);
            this.connected = false;
            this.updateStatus('error', window.i18n ? window.i18n.t('disconnected') : 'Connection disconnected');
            this.startBtn.disabled = true;
            this.stopBtn.disabled = true;
            
            // Try to reconnect after 5 seconds
            setTimeout(() => {
                console.log('🔄 [WEBSOCKET] Attempting to reconnect...');
                this.connect();
            }, 5000);
        };
        
        this.ws.onerror = (error) => {
            console.error('❌ [WEBSOCKET] Connection error:', error);
            this.updateStatus('error', window.i18n ? window.i18n.t('websocket_error') : 'WebSocket connection error');
        };
        
        this.ws.onmessage = (event) => {
            try {
                // If message is binary data (image frame)
                if (event.data instanceof Blob) {
                    // 视频帧不记录日志，避免刷屏
                    this.displayImageFrame(event.data);
                } else if (typeof event.data === 'string') {
                    // Parse JSON message
                    try {
                        const message = JSON.parse(event.data);
                        
                        // 专门为棋盘格标定调试记录关键信息
                        if (message.type === 'camera_calibration_status') {
                            console.log('🎯 [CALIBRATION DEBUG] Status update:', {
                                calibration_mode: message.calibration_mode,
                                current_session_count: message.current_session_count,
                                saved_count: message.saved_count,
                                calibrated: message.calibrated,
                                auto_capture_progress: message.auto_capture_progress
                            });
                            this.handleCameraCalibrationStatus(message);
                        } else if (message.type === 'auto_capture_started') {
                            console.log('🚀 [AUTO CAPTURE] Started:', message);
                            this.handleTextMessage(event.data);
                        } else if (message.type === 'auto_capture_stopped') {
                            console.log('🛑 [AUTO CAPTURE] Stopped:', message);
                            this.handleTextMessage(event.data);
                        } else if (message.type === 'chessboard_detected') {
                            console.log('♟️ [CHESSBOARD] Detected and saved:', message);
                            this.handleTextMessage(event.data);
                        } else if (message.type === 'error') {
                            console.error('❌ [ERROR]', message.message);
                            this.handleTextMessage(event.data);
                        } else if (message.type === 'frame_info') {
                            // frame_info 静默处理
                            this.handleFrameInfo(message);
                        } else if (message.type === 'aruco_detection_update') {
                            // ArUco实时检测更新
                            this.handleArUcoDetectionUpdate(message);
                        } else if (message.type === 'aruco_testing_results') {
                            // ArUco测试结果更新（用于显示检测到的标记详细信息）
                            this.updateArUcoTestingResults(message);
                        } else if (message.type === 'camera_calibration_download') {
                            // 相机内参标定文件下载
                            this.handleCameraCalibrationDownload(message);
                        } else {
                            // 其他消息类型简化记录
                            if (this.debugMode) {
                                console.log('📝 Message type:', message.type, message);
                            }
                            this.handleTextMessage(event.data);
                        }
                    } catch (parseError) {
                        console.error('❌ Error parsing JSON message:', parseError);
                        console.log('Raw message data:', event.data);
                    }
                } else {
                    console.log('❓ Unknown message type:', typeof event.data);
                }
            } catch (e) {
                console.error('💥 Error processing message:', e);
                console.log('Event data:', event.data);
            }
        };
    }
    
    handleCameraCalibrationStatus(message) {
        console.log('📨 [CALIBRATION] Received status:', message);
        
        // 清除可能存在的超时定时器
        if (this.toggleCameraCalibrationBtn && this.toggleCameraCalibrationBtn.timeoutId) {
            clearTimeout(this.toggleCameraCalibrationBtn.timeoutId);
            this.toggleCameraCalibrationBtn.timeoutId = null;
            console.log('🕒 [CALIBRATION] Cleared toggle timeout');
        }
        
        // 更新状态变量
        this.cameraCalibrationMode = message.calibration_mode;
        this.cameraCalibrated = message.calibrated;
        
        // 处理当前会话图片计数
        if (message.current_session_count !== undefined) {
            this.currentSessionImages = message.current_session_count;
            console.log(`📸 [SESSION] Current session images: ${this.currentSessionImages}`);
            
            if (this.currentSessionImagesCount) {
                const countText = window.i18n && window.i18n.getCurrentLanguage() === 'zh' ? 
                    `${this.currentSessionImages} 张` : 
                    `${this.currentSessionImages} images`;
                this.currentSessionImagesCount.textContent = countText;
                console.log(`🔄 [UI UPDATE] Current session count displayed: ${countText}`);
                
                // 添加更新动画
                this.currentSessionImagesCount.classList.add('updated');
                setTimeout(() => {
                    this.currentSessionImagesCount.classList.remove('updated');
                }, 500);
            } else {
                console.error('❌ [UI ERROR] currentSessionImagesCount element not found!');
            }
        }
        
        // 处理图像计数（保持向后兼容）
        if (message.image_count !== undefined) {
            this.calibrationImages = message.image_count;
            console.log(`📊 [CALIBRATION] Total images: ${this.calibrationImages}`);
        }
        
        // 处理已保存图片计数（磁盘上的文件数量）
        if (message.saved_count !== undefined) {
            const savedCount = message.saved_count;
            console.log(`💾 [SAVED COUNT] Disk saved images: ${savedCount}`);
            
            if (this.savedImagesCount) {
                const countText = window.i18n && window.i18n.getCurrentLanguage() === 'zh' ? 
                    `${savedCount} 张` : 
                    `${savedCount} images`;
                this.savedImagesCount.textContent = countText;
                console.log(`🔄 [UI UPDATE] Saved images count displayed: ${countText}`);
                
                // 添加更新动画
                this.savedImagesCount.classList.add('updated');
                setTimeout(() => {
                    this.savedImagesCount.classList.remove('updated');
                }, 500);
            } else {
                console.error('❌ [UI ERROR] savedImagesCount element not found!');
            }
        }
        
        // 更新标定误差显示
        if (message.error !== undefined && this.calibrationErrorDisplay) {
            const errorText = message.error.toFixed(2) + ' pixels';
            console.log(`📏 [CALIBRATION] Error: ${errorText}`);
            this.calibrationErrorDisplay.textContent = errorText;
        }
        
        // 检查UI元素状态
        console.log(`🔍 [UI DEBUG] Elements check:`, {
            currentSessionImagesCount: !!this.currentSessionImagesCount,
            savedImagesCount: !!this.savedImagesCount,
            calibrationErrorDisplay: !!this.calibrationErrorDisplay
        });
        
        // 恢复按钮状态并更新UI
        if (this.toggleCameraCalibrationBtn) {
            this.setButtonState(this.toggleCameraCalibrationBtn, '');
            this.toggleCameraCalibrationBtn.disabled = false;
            
            // 恢复按钮文本
            const newKey = this.cameraCalibrationMode ? 'exit_calibration_mode' : 'camera_calibration_mode';
            this.toggleCameraCalibrationBtn.setAttribute('data-i18n', newKey);
            
            if (window.i18n) {
                const span = this.toggleCameraCalibrationBtn.querySelector('span');
                if (span) {
                    span.textContent = window.i18n.t(newKey);
                }
            }
            
            console.log(`🔄 [UI] Button state restored, mode: ${this.cameraCalibrationMode ? 'ON' : 'OFF'}`);
        }
        
        // 更新UI状态
        this.updateCameraCalibrationUIWithStates();
        
        // 更新状态消息
        const statusMessage = this.cameraCalibrationMode ? 
            '相机标定模式已启用' : '相机标定模式已关闭';
        this.updateStatus('success', statusMessage);
        
        if (this.lastOperation) {
            this.lastOperation.textContent = statusMessage;
        }
    }
    
    handleFrameInfo(message) {
        // 处理帧信息消息
        if (message.width && message.height && this.resolutionElement) {
            this.resolutionElement.textContent = `${message.width}×${message.height}`;
            if (this.debugMode) {
                console.log(`📐 [FRAME INFO] Resolution: ${message.width}×${message.height}`);
            }
        }
    }
    
    handleTextMessage(message) {
        try {
            const data = JSON.parse(message);
            console.log('Received message:', data);
            
            if (data.type === 'status') {
                this.updateStatus(data.status, data.message);
            } else if (data.type === 'error') {
                console.error('Server error:', data.message);
                this.updateStatus('error', `Error: ${data.message}`);
                this.updateLastOperation(`Error: ${data.message}`);
            } else if (data.type === 'frame_info') {
                // Update resolution display
                if (this.resolutionElement) {
                    this.resolutionElement.textContent = `${data.width}×${data.height}`;
                }
            } else if (data.type === 'camera_info') {
                // 处理相机信息，包括棋盘格参数
                console.log('Received camera info:', data);
                
                // 更新棋盘格参数输入框
                if (data.board_width && this.boardWidthInput) {
                    this.boardWidthInput.value = data.board_width;
                }
                if (data.board_height && this.boardHeightInput) {
                    this.boardHeightInput.value = data.board_height;
                }
                if (data.square_size && this.squareSizeInput) {
                    this.squareSizeInput.value = data.square_size;
                }
                
                // 更新分辨率信息
                if (this.resolutionElement && data.current_width && data.current_height) {
                    this.resolutionElement.textContent = `${data.current_width}×${data.current_height}`;
                }
            } else if (data.type === 'calibration_result') {
                // Process calibration result
                console.log('Received calibration result:', data);
                
                if (data.success) {
                    this.calibrated = true;
                    
                    // Update homography matrix display
                    if (data.homography_matrix) {
                        this.updateHomographyMatrix(data.homography_matrix);
                        this.updateLastOperation('Calibration successful, homography matrix updated');
                    }
                    
                    // 如果是相机标定完成，询问是否要处理图片
                    if (data.calibration_error !== undefined) {
                        this.showCalibrationCleanupDialog(data.calibration_error);
                    }
                }
            } else if (data.type === 'camera_calibration_status') {
                this.handleCameraCalibrationStatus(data);
                
                // 如果包含棋盘格参数，更新输入框
                if (data.width && this.boardWidthInput) {
                    this.boardWidthInput.value = data.width;
                }
                if (data.height && this.boardHeightInput) {
                    this.boardHeightInput.value = data.height;
                }
                if (data.square_size && this.squareSizeInput) {
                    // 转换为毫米显示
                    this.squareSizeInput.value = Math.round(data.square_size * 1000);
                }
                
                // 显示会话消息
                if (data.session_message) {
                    this.updateStatus('info', data.session_message);
                }
                
                // 如果是自动采集过程中的更新，显示特殊提示
                if (data.auto_capture_progress) {
                    console.log('Auto capture progress update: current session =', data.current_session_count);
                    this.updateStatus('success', window.i18n ? 
                        window.i18n.t('auto_capture_image_added', {count: data.current_session_count}) || `已采集 ${data.current_session_count} 张图片` :
                        `Captured ${data.current_session_count} images`);
                }
            } else if (data.type === 'auto_capture_status') {
                // 处理自动采集状态消息
                console.log('Received auto capture status:', data);
                
                if (data.started !== undefined) {
                    if (data.started) {
                        this.updateStatus('success', window.i18n ? 
                            window.i18n.t('auto_capture_started') || '自动采集已开始' : 
                            'Auto capture started');
                        
                        // 设置自动采集按钮状态
                        this.setButtonState(this.startAutoCalibrationBtn, 'processing');
                        this.stopAutoCalibrationBtn.disabled = false;
                        
                        // 如果本地没有启动倒计时，则启动
                        if (!this.countdownInterval && data.duration && data.interval) {
                            this.startCountdown(data.duration, data.interval);
                        }
                    } else {
                        this.updateStatus('error', window.i18n ? 
                            window.i18n.t('auto_capture_failed') : 
                            'Failed to start auto capture');
                    }
                }
                
                if (data.stopped !== undefined) {
                    if (data.stopped) {
                        this.updateStatus('success', window.i18n ? 
                            window.i18n.t('auto_capture_stopped') : 
                            'Auto capture stopped');
                        
                        // 恢复按钮状态
                        this.setButtonState(this.startAutoCalibrationBtn, '');
                        this.stopAutoCalibrationBtn.disabled = true;
                        
                        // 停止倒计时
                        this.stopCountdown();
                    }
                }
            } else if (data.type === 'auto_capture_completed') {
                // 处理自动采集完成消息
                console.log('Auto capture completed:', data);
                
                this.updateStatus('success', window.i18n ? 
                    window.i18n.t('auto_capture_completed', {
                        success: data.success_count, 
                        total: data.attempt_count
                    }) : 
                    `Auto capture completed: ${data.success_count} successful out of ${data.attempt_count} attempts`);
                
                // 更新标定图像计数
                this.calibrationImages = data.image_count;
                this.updateCameraCalibrationUIWithStates();
                
                // 恢复按钮状态
                this.setButtonState(this.startAutoCalibrationBtn, '');
                this.stopAutoCalibrationBtn.disabled = true;
                
                // 停止倒计时
                this.stopCountdown();
                
                // 如果在自动采集过程中收到新图像，更新最后采集时间
                if (this.countdownInterval && data.image_count > this.calibrationImages) {
                    this.lastCaptureTime = Date.now();
                }
            } else if (data.type === 'camera_calibration_saved') {
                // 处理相机标定保存结果
                this.handleCameraCalibrationSaved(data);
            } else if (data.type === 'camera_calibration_loaded') {
                // 处理相机标定加载结果
                this.handleCameraCalibrationLoaded(data);
            } else if (data.type === 'camera_correction_toggled') {
                // 处理相机校正状态切换结果
                this.handleCameraCorrectionToggled(data);
            } else if (data.type === 'aruco_mode_status') {
                // 处理ArUco模式状态更新
                this.handleArUcoModeStatus(data);
            } else if (data.type === 'marker_coordinates_set') {
                // 处理标记坐标设置结果
                this.handleMarkerCoordinatesSet(data);
            } else if (data.type === 'marker_coordinates_saved') {
                // 处理标记坐标保存结果
                this.handleMarkerCoordinatesSaved(data);
            } else if (data.type === 'marker_coordinates_loaded') {
                // 处理标记坐标加载结果
                this.handleMarkerCoordinatesLoaded(data);
            } else if (data.type === 'aruco_params_reset') {
                // 处理 ArUco 参数重置响应
                this.handleArUcoParamsReset(data);
            } else if (data.type === 'calibration_mode_changed') {
                // 处理坐标标定模式变化
                this.handleCalibrationModeChanged(data);
            } else if (data.type === 'calibration_point_added') {
                // 处理标定点添加结果
                console.log('📍 [POINT ADDED] 标定点已添加:', data);
                this.updateStatus('success', '标定点添加成功');
            } else if (data.type === 'calibration_point_removed') {
                // 处理标定点移除结果
                console.log('🗑️ [POINT REMOVED] 标定点已移除:', data);
                this.updateStatus('success', '标定点移除成功');
            } else if (data.type === 'calibration_points_cleared') {
                // 处理标定点清除结果
                console.log('🧹 [POINTS CLEARED] 所有标定点已清除:', data);
                this.updateStatus('success', '所有标定点已清除');
            } else if (data.type === 'error_notification') {
                // 处理后端错误通知
                this.handleErrorNotification(data);
            } else if (data.type === 'homography_computed') {
                // 处理单应性矩阵计算结果
                this.handleHomographyComputed(data);
            } else if (data.type === 'homography_saved') {
                // 处理单应性矩阵保存结果
                console.log('💾 [HOMOGRAPHY SAVED]:', data);
                if (data.success) {
                    const saveSuccessMsg = window.i18n ? window.i18n.t('calibration_results_saved') : '标定结果保存成功';
                    this.updateStatus('success', saveSuccessMsg);
                    if (this.lastOperation) {
                        this.lastOperation.textContent = saveSuccessMsg;
                    }
                } else {
                    const saveFailedMsg = window.i18n ? window.i18n.t('calibration_results_save_failed') : '标定结果保存失败';
                    this.updateStatus('error', data.error || saveFailedMsg);
                    if (this.lastOperation) {
                        this.lastOperation.textContent = saveFailedMsg;
                    }
                }
            } else if (data.type === 'homography_loaded') {
                // 处理单应性矩阵加载结果
                console.log('📂 [HOMOGRAPHY LOADED]:', data);
                if (data.success) {
                    this.calibrated = true;
                    this.rawHomographyMatrix = data.homography_matrix;
                    
                    // 更新矩阵显示
                    if (data.homography_matrix) {
                        this.updateHomographyMatrix(data.homography_matrix);
                    }
                    
                    // 更新标定点
                    if (data.calibration_points) {
                        this.calibrationPoints = data.calibration_points.map(point => ({
                            image: { x: point.image_x, y: point.image_y },
                            ground: { x: point.ground_x, y: point.ground_y }
                        }));
                        this.updateCalibrationPointsList();
                    }
                    
                    this.updateCalibrationStatus();
                    const loadSuccessMsg = window.i18n ? window.i18n.t('calibration_results_loaded') : '标定结果加载成功';
                    this.updateStatus('success', loadSuccessMsg);
                    if (this.lastOperation) {
                        this.lastOperation.textContent = loadSuccessMsg;
                    }
                } else {
                    const loadFailedMsg = window.i18n ? window.i18n.t('calibration_results_load_failed') : '标定结果加载失败';
                    this.updateStatus('error', data.error || loadFailedMsg);
                    if (this.lastOperation) {
                        this.lastOperation.textContent = loadFailedMsg;
                    }
                }
            }
            
            // 更新检测到的标记数量
            if (data.detected_markers !== undefined) {
                const markersCount = document.getElementById('detectedMarkersCount');
                if (markersCount) {
                    markersCount.textContent = data.detected_markers;
                }
            }
        } catch (error) {
            console.error('Error processing text message:', error);
        }
    }

    handleBinaryMessage(data) {
        // 处理二进制数据（通常是图像）
        console.log('Received binary message, size:', data.byteLength);
    }
    
    updateStatus(status, message) {
        if (this.statusElement) {
            this.statusElement.textContent = message || status;
            this.statusElement.className = `status ${status}`;
        }
    }
    
    updateFps() {
        // Calculate FPS
        const fps = this.frameCount - this.lastFrameCount;
        this.lastFrameCount = this.frameCount;
        this.fps = fps;
        
        // 收集FPS历史数据用于分析
        if (!this.fpsHistory) {
            this.fpsHistory = [];
        }
        this.fpsHistory.push(fps);
        
        // 保持最近10秒的FPS数据
        if (this.fpsHistory.length > 10) {
            this.fpsHistory.shift();
        }
        
        // Update FPS display with color coding
        if (this.fpsElement) {
            this.fpsElement.textContent = `${this.fps} FPS`;
            
            // 根据FPS给出颜色提示
            if (this.fps < 10) {
                this.fpsElement.style.color = '#dc3545'; // 红色：极低FPS
                this.fpsElement.style.fontWeight = 'bold';
            } else if (this.fps < 20) {
                this.fpsElement.style.color = '#fd7e14'; // 橙色：低FPS
                this.fpsElement.style.fontWeight = 'bold';
            } else if (this.fps < 25) {
                this.fpsElement.style.color = '#ffc107'; // 黄色：中等FPS
                this.fpsElement.style.fontWeight = 'normal';
            } else {
                this.fpsElement.style.color = '#28a745'; // 绿色：良好FPS
                this.fpsElement.style.fontWeight = 'normal';
            }
        }
        
        // 每10秒进行一次FPS分析
        if (!this.lastFpsAnalysis) {
            this.lastFpsAnalysis = 0;
        }
        const now = Date.now();
        if (now - this.lastFpsAnalysis > 10000) { // 10秒间隔
            this.analyzeFpsPerformance();
            this.lastFpsAnalysis = now;
        }
    }
    
    // FPS性能分析
    analyzeFpsPerformance() {
        if (!this.performanceData || this.performanceData.samples.length === 0) return;
        
        const samples = this.performanceData.samples;
        const count = samples.length;
        
        // 计算平均值
        const avgFrameLatency = samples.reduce((sum, s) => sum + s.frameLatency, 0) / count;
        const avgUrlCreateLatency = samples.reduce((sum, s) => sum + s.urlCreateLatency, 0) / count;
        const avgImageLoadLatency = samples.reduce((sum, s) => sum + s.imageLoadLatency, 0) / count;
        const avgTotalProcessingLatency = samples.reduce((sum, s) => sum + s.totalProcessingLatency, 0) / count;
        const avgBlobSize = samples.reduce((sum, s) => sum + s.blobSize, 0) / count;
        
        // 计算最大值
        const maxFrameLatency = Math.max(...samples.map(s => s.frameLatency));
        const maxTotalProcessingLatency = Math.max(...samples.map(s => s.totalProcessingLatency));
        
        // 计算实际FPS
        const timeSpan = samples[samples.length - 1].timestamp - samples[0].timestamp;
        const actualFPS = (count - 1) / (timeSpan / 1000);
        
        console.log('🔍 [FRONTEND PERFORMANCE REPORT]');
        console.log(`📊 Frame Count: ${count} frames in ${(timeSpan/1000).toFixed(1)}s`);
        console.log(`🎯 Actual FPS: ${actualFPS.toFixed(1)} fps`);
        console.log(`⏱️ Frame Latency: avg=${avgFrameLatency.toFixed(1)}ms, max=${maxFrameLatency.toFixed(1)}ms`);
        console.log(`🔗 URL Create: avg=${avgUrlCreateLatency.toFixed(2)}ms`);
        console.log(`🖼️ Image Load: avg=${avgImageLoadLatency.toFixed(2)}ms`);
        console.log(`📱 Total Processing: avg=${avgTotalProcessingLatency.toFixed(2)}ms, max=${maxTotalProcessingLatency.toFixed(1)}ms`);
        console.log(`📦 Avg Blob Size: ${(avgBlobSize/1024).toFixed(1)}KB`);
        
        // 性能评估和优化建议
        const suggestions = this.generateOptimizationSuggestions({
            avgFrameLatency,
            maxFrameLatency,
            avgTotalProcessingLatency,
            maxTotalProcessingLatency,
            actualFPS,
            avgBlobSize
        });
        
        if (suggestions.length > 0) {
            console.log('💡 [OPTIMIZATION SUGGESTIONS]');
            suggestions.forEach((suggestion, index) => {
                console.log(`${index + 1}. ${suggestion}`);
            });
        }
        
        // 清空样本数据
        this.performanceData.samples = [];
    }
    
    // 生成性能优化建议
    generateOptimizationSuggestions(metrics) {
        const suggestions = [];
        
        // 网络延迟问题
        if (metrics.avgFrameLatency > 200) {
            suggestions.push('🌐 网络延迟过高 (>200ms)：检查网络连接质量，考虑使用有线连接');
        } else if (metrics.avgFrameLatency > 100) {
            suggestions.push('🌐 网络延迟较高 (>100ms)：优化网络配置或降低视频质量');
        }
        
        // FPS问题
        if (metrics.actualFPS < 15) {
            suggestions.push('🎯 帧率过低 (<15fps)：服务器性能不足或网络带宽限制');
        } else if (metrics.actualFPS < 25) {
            suggestions.push('🎯 帧率偏低 (<25fps)：考虑降低分辨率或关闭相机校正');
        }
        
        // 前端处理延迟
        if (metrics.avgTotalProcessingLatency > 50) {
            suggestions.push('📱 前端处理延迟高 (>50ms)：浏览器性能不足，尝试关闭其他标签页');
        }
        
        // 图像大小问题
        if (metrics.avgBlobSize > 500 * 1024) { // >500KB
            suggestions.push('📦 图像文件过大 (>500KB)：降低JPEG质量或分辨率以提高传输速度');
        } else if (metrics.avgBlobSize > 200 * 1024) { // >200KB
            suggestions.push('📦 图像文件较大 (>200KB)：考虑降低图像质量以提高性能');
        }
        
        // 延迟波动问题
        const latencyVariation = metrics.maxFrameLatency - metrics.avgFrameLatency;
        if (latencyVariation > 100) {
            suggestions.push('📈 延迟波动大：网络不稳定或服务器负载不均');
        }
        
        // 特定模式建议
        if (this.cameraCalibrationMode) {
            suggestions.push('📷 标定模式性能提示：标定时自动降低处理频率，完成标定后性能会提升');
        }
        
        if (this.cameraCalibrated && this.enableCameraCorrectionToggle?.checked) {
            suggestions.push('🔧 校正模式性能提示：相机校正会增加处理延迟，可临时关闭以提高帧率');
        }
        
        // 系统建议
        if (metrics.actualFPS > 25 && metrics.avgFrameLatency < 50) {
            suggestions.push('✅ 性能良好：当前配置运行流畅');
        }
        
        return suggestions;
    }

    // 添加自动采集方法
    startAutoCalibrationCapture() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.error('❌ [WEBSOCKET] Not connected for auto capture');
            this.updateStatus('error', 'WebSocket not connected');
            return;
        }
        
        // 自动采集前直接开始新会话，不需要额外的用户操作
        const duration = parseInt(this.autoCaptureTimeInput.value) || 10;
        const interval = parseInt(this.autoCaptureIntervalInput.value) || 500;
        
        console.log(`🚀 [AUTO CAPTURE] Starting: ${duration}s duration, ${interval}ms interval`);
        
        // 设置处理状态
        this.setButtonState(this.startAutoCalibrationBtn, 'processing');
        
        // 保存采集参数
        this.autoCaptureIntervalMs = interval;

        const message = {
            action: 'start_auto_calibration_capture',
            duration: duration,
            interval: interval
        };
        
        console.log('📤 [WEBSOCKET] Sending auto capture message:', message);
        this.ws.send(JSON.stringify(message));
        
        if (this.lastOperation) {
            const text = window.i18n ? 
                window.i18n.t('starting_auto_capture', {duration: duration, interval: interval}) : 
                `Starting auto capture for ${duration}s with ${interval}ms interval`;
            this.lastOperation.textContent = text;
        }
        
        // 启动倒计时显示
        this.startCountdown(duration, interval);
        
        this.updateStatus('info', '开始自动采集标定图片');
    }

    stopAutoCalibrationCapture() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.error('WebSocket not connected');
            this.updateStatus('error', 'WebSocket not connected');
            return;
        }
        
        const stopMessage = {
            action: 'stop_auto_calibration_capture'
        };
        
        console.log('Sending stop auto capture message:', stopMessage);
        this.ws.send(JSON.stringify(stopMessage));
        
        if (this.lastOperation) {
            const text = window.i18n ? 
                window.i18n.t('stopping_auto_capture') : 
                'Stopping auto capture';
            this.lastOperation.textContent = text;
        }
        
        this.updateStatus('info', '停止自动采集');
        
        // 停止倒计时
        this.stopCountdown();
    }
    
    // 启动倒计时功能
    startCountdown(durationSeconds, intervalMs) {
        // 设置时间参数
        this.autoCaptureStartTime = Date.now();
        this.autoCaptureEndTime = this.autoCaptureStartTime + (durationSeconds * 1000);
        this.lastCaptureTime = this.autoCaptureStartTime;
        
        // 显示倒计时区域
        if (this.countdownDisplay) {
            this.countdownDisplay.style.display = 'block';
        }
        
        // 启动倒计时更新
        this.countdownInterval = setInterval(() => {
            this.updateCountdown(intervalMs);
        }, 100); // 每100ms更新一次显示
        
        console.log('Countdown started for', durationSeconds, 'seconds');
    }
    
    // 停止倒计时功能
    stopCountdown() {
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
        }
        
        // 隐藏倒计时区域
        if (this.countdownDisplay) {
            this.countdownDisplay.style.display = 'none';
        }
        
        console.log('Countdown stopped');
    }
    
    // 更新倒计时显示
    updateCountdown(intervalMs) {
        const now = Date.now();
        
        // 计算剩余时间
        const remainingMs = Math.max(0, this.autoCaptureEndTime - now);
        const remainingSeconds = Math.ceil(remainingMs / 1000);
        
        // 计算下次采集倒计时
        const timeSinceLastCapture = now - this.lastCaptureTime;
        const nextCaptureMs = Math.max(0, intervalMs - timeSinceLastCapture);
        const nextCaptureSeconds = Math.ceil(nextCaptureMs / 1000);
        
        // 计算进度百分比
        const totalMs = this.autoCaptureEndTime - this.autoCaptureStartTime;
        const elapsedMs = now - this.autoCaptureStartTime;
        const progressPercent = Math.min(100, Math.max(0, (elapsedMs / totalMs) * 100));
        
        // 更新显示
        if (this.remainingTime) {
            this.remainingTime.textContent = `${remainingSeconds}s`;
            this.remainingTime.className = 'countdown-value';
            if (remainingSeconds <= 5) {
                this.remainingTime.className += ' warning';
            }
        }
        
        if (this.nextCaptureTime) {
            this.nextCaptureTime.textContent = `${nextCaptureSeconds}s`;
            this.nextCaptureTime.className = 'countdown-value';
        }
        
        if (this.captureProgress) {
            this.captureProgress.textContent = `${Math.round(progressPercent)}%`;
            this.captureProgress.className = 'countdown-value progress';
        }
        
        // 检查是否结束
        if (remainingMs <= 0) {
            this.stopCountdown();
        }
    }

    // 请求当前标定状态
    requestCurrentStatus() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            console.log('📋 [STATUS REQUEST] Sending get_calibration_status...');
            this.ws.send(JSON.stringify({
                action: 'get_calibration_status'
            }));
            
            // 显示WebSocket连接状态信息
            console.log('🔗 [WEBSOCKET DEBUG] Connection details:', {
                readyState: this.ws.readyState,
                url: this.ws.url,
                protocol: this.ws.protocol,
                connected: this.connected
            });
        } else {
            console.warn('❌ [STATUS REQUEST] WebSocket not connected, readyState:', this.ws ? this.ws.readyState : 'null');
        }
    }

    showCalibrationCleanupDialog(calibrationError) {
        // 根据标定误差确定建议的处理方式
        let qualityLevel, recommendation, bgColor;
        
        if (calibrationError < 1.0) {
            qualityLevel = '优秀';
            recommendation = 'excellent';
            bgColor = '#d4edda';
        } else if (calibrationError < 2.0) {
            qualityLevel = '良好';
            recommendation = 'good';
            bgColor = '#fff3cd';
        } else {
            qualityLevel = '需要改进';
            recommendation = 'poor';
            bgColor = '#f8d7da';
        }
        
        // 创建对话框HTML
        const dialogHtml = `
            <div id="calibrationCleanupDialog" style="
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.7);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 10000;
            ">
                <div style="
                    background: white;
                    border-radius: 8px;
                    padding: 30px;
                    max-width: 500px;
                    width: 90%;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                ">
                    <h3 style="margin-top: 0; text-align: center; color: #333;">
                        🎯 相机标定完成
                    </h3>
                    
                    <div style="
                        background: ${bgColor};
                        border-radius: 6px;
                        padding: 15px;
                        margin: 20px 0;
                        text-align: center;
                    ">
                        <strong>标定质量：${qualityLevel}</strong><br>
                        <span style="font-size: 14px;">重投影误差：${calibrationError.toFixed(3)} 像素</span>
                    </div>
                    
                    <p style="margin: 20px 0; line-height: 1.6; color: #555;">
                        当前有 <strong>${this.calibrationImages}</strong> 张标定图片。
                        根据标定质量，建议您选择相应的处理方式：
                    </p>
                    
                    <div style="margin: 20px 0;">
                        <button id="cleanupExcellent" class="cleanup-option-btn" data-type="excellent" style="
                            width: 100%;
                            margin: 8px 0;
                            padding: 12px;
                            border: 2px solid #28a745;
                            background: ${recommendation === 'excellent' ? '#28a745' : 'white'};
                            color: ${recommendation === 'excellent' ? 'white' : '#28a745'};
                            border-radius: 4px;
                            cursor: pointer;
                            font-weight: bold;
                        ">
                            ✅ 优秀处理 - 备份并清理，保留少量验证图片
                        </button>
                        
                        <button id="cleanupGood" class="cleanup-option-btn" data-type="good" style="
                            width: 100%;
                            margin: 8px 0;
                            padding: 12px;
                            border: 2px solid #ffc107;
                            background: ${recommendation === 'good' ? '#ffc107' : 'white'};
                            color: ${recommendation === 'good' ? 'white' : '#ffc107'};
                            border-radius: 4px;
                            cursor: pointer;
                            font-weight: bold;
                        ">
                            ⚠️ 良好处理 - 备份并选择性保留质量好的图片
                        </button>
                        
                        <button id="cleanupPoor" class="cleanup-option-btn" data-type="poor" style="
                            width: 100%;
                            margin: 8px 0;
                            padding: 12px;
                            border: 2px solid #dc3545;
                            background: ${recommendation === 'poor' ? '#dc3545' : 'white'};
                            color: ${recommendation === 'poor' ? 'white' : '#dc3545'};
                            border-radius: 4px;
                            cursor: pointer;
                            font-weight: bold;
                        ">
                            🔄 重新采集 - 备份问题图片并完全清理
                        </button>
                        
                        <button id="cleanupBackup" class="cleanup-option-btn" data-type="backup" style="
                            width: 100%;
                            margin: 8px 0;
                            padding: 12px;
                            border: 2px solid #6c757d;
                            background: white;
                            color: #6c757d;
                            border-radius: 4px;
                            cursor: pointer;
                        ">
                            💾 仅备份 - 保持现状，只做备份
                        </button>
                    </div>
                    
                    <div style="text-align: center; margin-top: 20px;">
                        <button id="cleanupLater" style="
                            padding: 10px 20px;
                            border: 1px solid #ccc;
                            background: white;
                            color: #666;
                            border-radius: 4px;
                            cursor: pointer;
                            margin-right: 10px;
                        ">
                            稍后处理
                        </button>
                        
                        <button id="cleanupManual" style="
                            padding: 10px 20px;
                            border: 1px solid #007bff;
                            background: #007bff;
                            color: white;
                            border-radius: 4px;
                            cursor: pointer;
                        ">
                            手动处理
                        </button>
                    </div>
                    
                    <p style="font-size: 12px; color: #888; text-align: center; margin-top: 15px;">
                        💡 建议：根据标定质量选择对应颜色的选项
                    </p>
                </div>
            </div>
        `;
        
        // 添加对话框到页面
        document.body.insertAdjacentHTML('beforeend', dialogHtml);
        
        // 绑定事件处理器
        const dialog = document.getElementById('calibrationCleanupDialog');
        
        // 选项按钮事件
        document.querySelectorAll('.cleanup-option-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const type = btn.getAttribute('data-type');
                this.executeCleanup(type);
                this.closeCleanupDialog();
            });
        });
        
        // 稍后处理按钮
        document.getElementById('cleanupLater').addEventListener('click', () => {
            this.closeCleanupDialog();
        });
        
        // 手动处理按钮
        document.getElementById('cleanupManual').addEventListener('click', () => {
            this.updateStatus('info', '请在终端中运行：./cleanup_calibration.sh [选项]');
            this.closeCleanupDialog();
        });
        
        // 点击背景关闭
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) {
                this.closeCleanupDialog();
            }
        });
    }
    
    closeCleanupDialog() {
        const dialog = document.getElementById('calibrationCleanupDialog');
        if (dialog) {
            dialog.remove();
        }
    }
    
    executeCleanup(type) {
        // 发送清理请求到后端
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            const message = {
                action: 'cleanup_calibration_images',
                cleanup_type: type
            };
            this.ws.send(JSON.stringify(message));
            this.updateStatus('info', `正在执行${type}级别的图片清理...`);
        } else {
            this.updateStatus('error', 'WebSocket连接不可用，请手动执行清理');
        }
    }
    
    // 切换相机校正状态
    toggleCameraCorrection(enabled) {
        console.log(`📸 [CAMERA CORRECTION] Toggling to: ${enabled}`);
        
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.error('❌ [CAMERA CORRECTION] WebSocket not connected');
            // 重置开关状态
            if (this.enableCameraCorrectionToggle) {
                this.enableCameraCorrectionToggle.checked = !enabled;
            }
            return;
        }

        // 更新状态显示为加载中
        this.updateCorrectionStatus('loading');

        // 发送切换命令到后端
        this.send({
            action: 'toggle_camera_correction',
            enabled: enabled
        });
    }

    // 更新校正状态显示
    updateCorrectionStatus(status, enabled = false) {
        if (!this.correctionStatus) return;

        const statusElement = this.correctionStatus.querySelector('.status-text');
        if (!statusElement) return;

        // 清除现有的状态类
        this.correctionStatus.classList.remove('active', 'inactive', 'loading');

        switch (status) {
            case 'active':
                this.correctionStatus.classList.add('active');
                statusElement.textContent = window.i18n ? window.i18n.t('correction_active') : '校正已激活';
                break;
            case 'inactive':
                this.correctionStatus.classList.add('inactive');
                statusElement.textContent = window.i18n ? window.i18n.t('correction_inactive') : '校正未激活';
                break;
            case 'loading':
                this.correctionStatus.classList.add('loading');
                statusElement.textContent = window.i18n ? window.i18n.t('correction_switching') : '状态切换中...';
                break;
            default:
                this.correctionStatus.classList.add('inactive');
                statusElement.textContent = window.i18n ? window.i18n.t('correction_inactive') : '校正未激活';
        }
    }

    // 处理相机校正状态切换响应
    handleCameraCorrectionToggled(data) {
        console.log('📸 [CAMERA CORRECTION] Received toggle response:', data);
        
        if (data.success) {
            const enabled = data.enabled;
            const status = enabled ? 'active' : 'inactive';
            
            // 更新主开关状态
            if (this.enableCameraCorrectionToggle) {
                this.enableCameraCorrectionToggle.checked = enabled;
            }
            
            // 更新浮动面板开关状态
            if (this.floatingEnableCameraCorrectionToggle) {
                this.floatingEnableCameraCorrectionToggle.checked = enabled;
            }
            
            // 更新状态显示
            this.updateCorrectionStatus(status);
            this.updateFloatingCorrectionStatus(status);
            
            // 更新校正效果显示
            this.updateCorrectionEffectDisplay();
            
            // 更新延迟显示
            if (this.correctionLatency) {
                this.correctionLatency.textContent = enabled ? '监控中...' : '--ms';
            }
            
            // 更新全局状态消息
            const message = enabled ? 
                (window.i18n ? window.i18n.t('correction_enabled') : '相机校正已启用') :
                (window.i18n ? window.i18n.t('correction_disabled') : '相机校正已禁用');
            this.updateStatus('success', message);
            
            console.log(`✅ [CAMERA CORRECTION] Successfully ${enabled ? 'enabled' : 'disabled'}`);
        } else {
            // 切换失败，恢复开关状态
            if (this.enableCameraCorrectionToggle) {
                this.enableCameraCorrectionToggle.checked = !this.enableCameraCorrectionToggle.checked;
            }
            if (this.floatingEnableCameraCorrectionToggle) {
                this.floatingEnableCameraCorrectionToggle.checked = !this.floatingEnableCameraCorrectionToggle.checked;
            }
            
            // 显示错误状态
            this.updateCorrectionStatus('inactive');
            this.updateFloatingCorrectionStatus('inactive');
            
            const errorMsg = data.error || '相机校正状态切换失败';
            this.updateStatus('error', errorMsg);
            
            console.error('❌ [CAMERA CORRECTION] Toggle failed:', errorMsg);
        }
    }
    
    // 更新浮动面板校正状态显示
    updateFloatingCorrectionStatus(status) {
        if (!this.floatingCorrectionStatus) return;
        
        // 移除所有状态类
        this.floatingCorrectionStatus.classList.remove('active', 'inactive', 'loading');
        
        // 添加新状态类
        this.floatingCorrectionStatus.classList.add(status);
        
        // 更新状态文本
        const statusText = this.floatingCorrectionStatus.querySelector('.status-text');
        if (statusText) {
            switch (status) {
                case 'active':
                    statusText.textContent = window.i18n ? window.i18n.t('correction_active') : '校正激活';
                    break;
                case 'inactive':
                    statusText.textContent = window.i18n ? window.i18n.t('correction_inactive') : '校正未激活';
                    break;
                case 'loading':
                    statusText.textContent = window.i18n ? window.i18n.t('correction_loading') : '切换中...';
                    break;
            }
        }
    }
    
    // 显示浮动相机校正面板
    showFloatingCorrectionPanel() {
        if (this.floatingCorrectionPanel) {
            this.floatingCorrectionPanel.style.display = 'block';
            
            // 同步主面板的校正状态到浮动面板
            this.syncCorrectionStates();
            
            console.log('📷 [UI] Floating correction panel shown');
        }
    }
    
    // 隐藏浮动相机校正面板
    hideFloatingCorrectionPanel() {
        if (this.floatingCorrectionPanel) {
            this.floatingCorrectionPanel.style.display = 'none';
            console.log('📷 [UI] Floating correction panel hidden');
        }
    }
    
    // 同步校正状态（主面板和浮动面板）
    syncCorrectionStates() {
        // 同步开关状态
        if (this.enableCameraCorrectionToggle && this.floatingEnableCameraCorrectionToggle) {
            this.floatingEnableCameraCorrectionToggle.checked = this.enableCameraCorrectionToggle.checked;
            this.floatingEnableCameraCorrectionToggle.disabled = this.enableCameraCorrectionToggle.disabled;
        }
        
        // 同步状态显示
        if (this.correctionStatus && this.floatingCorrectionStatus) {
            this.floatingCorrectionStatus.className = this.correctionStatus.className;
            const statusText = this.correctionStatus.querySelector('.status-text');
            const floatingStatusText = this.floatingCorrectionStatus.querySelector('.status-text');
            if (statusText && floatingStatusText) {
                floatingStatusText.textContent = statusText.textContent;
            }
        }
        
        // 更新校正效果显示
        this.updateCorrectionEffectDisplay();
    }
    
    // 更新校正效果显示
    updateCorrectionEffectDisplay() {
        if (!this.correctionEffectDisplay) return;
        
        let effectText = '未知';
        let effectColor = '#6c757d';
        
        if (!this.cameraCalibrated) {
            effectText = '未标定';
            effectColor = '#dc3545';
        } else if (!this.enableCameraCorrectionToggle?.checked) {
            effectText = '已关闭';
            effectColor = '#fd7e14';
        } else if (this.cameraCalibrationMode) {
            effectText = '标定模式（暂停）';
            effectColor = '#ffc107';
        } else {
            effectText = '正在校正';
            effectColor = '#28a745';
        }
        
        this.correctionEffectDisplay.textContent = effectText;
        this.correctionEffectDisplay.style.color = effectColor;
    }

    // 网络延迟测试功能
    testNetworkLatency() {
        const testCount = 10;
        const latencies = [];
        let completedTests = 0;
        
        console.log('🌐 [NETWORK TEST] Starting latency test...');
        
        for (let i = 0; i < testCount; i++) {
            const startTime = performance.now();
            
            // 发送小的ping请求到服务器
            fetch('/api/ping', {
                method: 'GET',
                cache: 'no-cache'
            }).then(response => {
                const endTime = performance.now();
                const latency = endTime - startTime;
                latencies.push(latency);
                completedTests++;
                
                if (completedTests === testCount) {
                    this.analyzeNetworkLatency(latencies);
                }
            }).catch(error => {
                console.error('Network test failed:', error);
                completedTests++;
            });
            
            // 间隔100ms发送下一个请求
            setTimeout(() => {}, 100 * i);
        }
    }
    
    // 分析网络延迟结果
    analyzeNetworkLatency(latencies) {
        if (latencies.length === 0) {
            console.error('❌ [NETWORK TEST] No valid latency measurements');
            return;
        }
        
        const avgLatency = latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length;
        const minLatency = Math.min(...latencies);
        const maxLatency = Math.max(...latencies);
        const jitter = maxLatency - minLatency;
        
        console.log('📊 [NETWORK TEST] Results:');
        console.log(`  📶 Average Latency: ${avgLatency.toFixed(1)}ms`);
        console.log(`  ⚡ Min Latency: ${minLatency.toFixed(1)}ms`);
        console.log(`  🔺 Max Latency: ${maxLatency.toFixed(1)}ms`);
        console.log(`  📈 Jitter: ${jitter.toFixed(1)}ms`);
        
        // 网络质量评估
        let networkQuality = 'unknown';
        let recommendations = [];
        
        if (avgLatency < 10) {
            networkQuality = '优秀 (有线网络水平)';
            recommendations.push('✅ 网络延迟优秀，适合高帧率视频流');
        } else if (avgLatency < 30) {
            networkQuality = '良好 (5GHz WiFi水平)';
            recommendations.push('✅ 网络延迟良好，可支持流畅视频流');
        } else if (avgLatency < 50) {
            networkQuality = '一般 (2.4GHz WiFi水平)';
            recommendations.push('⚠️ 建议切换到5GHz WiFi或有线网络');
        } else {
            networkQuality = '较差';
            recommendations.push('❌ 强烈建议使用有线网络');
        }
        
        if (jitter > 50) {
            recommendations.push('📈 网络抖动大，可能影响视频流稳定性');
        }
        
        console.log(`  🏆 Network Quality: ${networkQuality}`);
        if (recommendations.length > 0) {
            console.log('  💡 Recommendations:');
            recommendations.forEach((rec, idx) => {
                console.log(`    ${idx + 1}. ${rec}`);
            });
        }
        
        // 存储测试结果用于对比
        this.lastNetworkTest = {
            timestamp: new Date().toISOString(),
            avgLatency,
            minLatency,
            maxLatency,
            jitter,
            quality: networkQuality
        };
    }
    
    // 对比网络测试结果
    compareNetworkTests() {
        if (!this.lastNetworkTest || !this.previousNetworkTest) {
            console.log('❌ [NETWORK COMPARE] Need at least two test results to compare');
            return;
        }
        
        const current = this.lastNetworkTest;
        const previous = this.previousNetworkTest;
        
        console.log('🔄 [NETWORK COMPARE] Comparing network tests:');
        console.log(`  Previous: ${previous.avgLatency.toFixed(1)}ms (${previous.quality})`);
        console.log(`  Current:  ${current.avgLatency.toFixed(1)}ms (${current.quality})`);
        
        const improvement = previous.avgLatency - current.avgLatency;
        const improvementPercent = (improvement / previous.avgLatency) * 100;
        
        if (improvement > 5) {
            console.log(`  ✅ IMPROVEMENT: ${improvement.toFixed(1)}ms faster (${improvementPercent.toFixed(1)}% improvement)`);
        } else if (improvement < -5) {
            console.log(`  ❌ DEGRADATION: ${Math.abs(improvement).toFixed(1)}ms slower (${Math.abs(improvementPercent).toFixed(1)}% worse)`);
        } else {
            console.log(`  ➡️ SIMILAR: No significant change`);
        }
    }
    
    // 修复：相机标定模式切换方法
    toggleCameraCalibrationMode() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.error('WebSocket not connected');
            this.updateStatus('error', 'WebSocket not connected');
            return;
        }
        
        // 防止重复点击
        if (this.toggleCameraCalibrationBtn.disabled) {
            console.log('🔒 [UI] Button is disabled, ignoring click');
            return;
        }
        
        // 设置处理状态和防重复点击
        this.setButtonState(this.toggleCameraCalibrationBtn, 'processing');
        this.toggleCameraCalibrationBtn.disabled = true;
        
        // 添加视觉反馈
        const originalText = this.toggleCameraCalibrationBtn.querySelector('span').textContent;
        this.toggleCameraCalibrationBtn.querySelector('span').textContent = window.i18n ? window.i18n.t('correction_switching') : '状态切换中...';
        
        const message = {
            action: 'toggle_camera_calibration_mode'
        };
        
        console.log('📤 [CALIBRATION] Sending toggle request:', message);
        this.ws.send(JSON.stringify(message));
        
        // Update last operation information
        if (this.lastOperation) {
            this.lastOperation.textContent = window.i18n ? window.i18n.t('switching_camera_calibration_mode') : '正在切换相机标定模式...';
        }
        
        // 设置超时处理 - 5秒后如果没有响应则恢复按钮状态
        const timeoutId = setTimeout(() => {
            console.warn('⚠️ [CALIBRATION] Toggle timeout, restoring button state');
            this.setButtonState(this.toggleCameraCalibrationBtn, '');
            this.toggleCameraCalibrationBtn.disabled = false;
            this.toggleCameraCalibrationBtn.querySelector('span').textContent = originalText;
            this.updateStatus('warning', '相机标定模式切换超时，请重试');
            
            if (this.lastOperation) {
                this.lastOperation.textContent = '模式切换超时';
            }
        }, 5000);
        
        // 保存超时ID以便在收到响应时清除
        this.toggleCameraCalibrationBtn.timeoutId = timeoutId;
    }
    
    // 修复：显示图像帧方法
    displayImageFrame(blob) {
        try {
            // 性能监控：接收时间戳
            const receiveTime = performance.now();
            
            // Clean up previous URL
            if (this.currentBlobUrl) {
                URL.revokeObjectURL(this.currentBlobUrl);
            }
            
            // Create new blob URL
            const url = URL.createObjectURL(blob);
            this.currentBlobUrl = url;
            
            // 性能监控：URL创建时间
            const urlCreateTime = performance.now();
            
            // Directly set to img element
            if (this.video) {
                this.video.onload = () => {
                    // 性能监控：图像显示时间
                    const displayTime = performance.now();
                    
                    // Update frame count and time
                    this.frameCount++;
                    const now = performance.now();
                    this.latency = now - this.lastFrameTime;
                    this.lastFrameTime = now;
                    
                    // 性能分析
                    const urlCreateLatency = urlCreateTime - receiveTime;
                    const imageLoadLatency = displayTime - urlCreateTime;
                    const totalProcessingLatency = displayTime - receiveTime;
                    
                    // 收集性能数据
                    if (!this.performanceData) {
                        this.performanceData = {
                            samples: [],
                            lastReport: now
                        };
                    }
                    
                    this.performanceData.samples.push({
                        frameLatency: this.latency,
                        urlCreateLatency: urlCreateLatency,
                        imageLoadLatency: imageLoadLatency,
                        totalProcessingLatency: totalProcessingLatency,
                        blobSize: blob.size,
                        timestamp: now
                    });
                    
                    // 每5秒输出一次性能报告
                    if (now - this.performanceData.lastReport > 5000 && this.performanceData.samples.length > 0) {
                        this.generatePerformanceReport();
                        this.performanceData.lastReport = now;
                    }
                    
                    // Update latency display
                    if (this.latencyElement) {
                        this.latencyElement.textContent = `${Math.round(this.latency)} ms`;
                        
                        // 根据延迟给出颜色提示
                        if (this.latency > 200) {
                            this.latencyElement.style.color = '#dc3545'; // 红色：高延迟
                        } else if (this.latency > 100) {
                            this.latencyElement.style.color = '#ffc107'; // 黄色：中等延迟
                        } else {
                            this.latencyElement.style.color = '#28a745'; // 绿色：低延迟
                        }
                    }
                    
                    // Update resolution display
                    if (this.resolutionElement && this.video.naturalWidth && this.video.naturalHeight) {
                        this.resolutionElement.textContent = `${this.video.naturalWidth}×${this.video.naturalHeight}`;
                    }
                    
                    // 更新浮动面板的延迟显示
                    if (this.correctionLatency) {
                        this.correctionLatency.textContent = `${Math.round(totalProcessingLatency)}ms`;
                    }
                };
                
                this.video.onerror = (e) => {
                    console.error('❌ [VIDEO] Failed to load frame:', e);
                };
                
                this.video.src = url;
            } else {
                console.error('❌ [VIDEO] Video element not found');
            }
            
        } catch (error) {
            console.error('❌ [VIDEO] Error in displayImageFrame:', error);
        }
    }
    
    // 生成性能报告方法
    generatePerformanceReport() {
        if (!this.performanceData || this.performanceData.samples.length === 0) return;
        
        const samples = this.performanceData.samples;
        const count = samples.length;
        
        if (count === 0) return;
        
        // 计算平均值
        const avgFrameLatency = samples.reduce((sum, s) => sum + s.frameLatency, 0) / count;
        const avgUrlCreateLatency = samples.reduce((sum, s) => sum + s.urlCreateLatency, 0) / count;
        const avgImageLoadLatency = samples.reduce((sum, s) => sum + s.imageLoadLatency, 0) / count;
        const avgTotalProcessingLatency = samples.reduce((sum, s) => sum + s.totalProcessingLatency, 0) / count;
        const avgBlobSize = samples.reduce((sum, s) => sum + s.blobSize, 0) / count;
        
        // 计算最大值
        const maxFrameLatency = Math.max(...samples.map(s => s.frameLatency));
        const maxTotalProcessingLatency = Math.max(...samples.map(s => s.totalProcessingLatency));
        
        // 计算理论和实际FPS
        const theoreticalFPS = count / 5; // 5秒内的帧数
        const actualFPS = count / ((samples[count-1].timestamp - samples[0].timestamp) / 1000);
        
        console.log('📊 [PERFORMANCE REPORT] 5-second analysis:');
        console.log(`📺 Frames processed: ${count}`);
        console.log(`🔄 Theoretical FPS: ${theoreticalFPS.toFixed(1)}, Actual FPS: ${actualFPS.toFixed(1)}`);
        console.log(`⏱️ Frame Latency: avg=${avgFrameLatency.toFixed(1)}ms, max=${maxFrameLatency.toFixed(1)}ms`);
        console.log(`🔗 URL Create: avg=${avgUrlCreateLatency.toFixed(2)}ms`);
        console.log(`🖼️ Image Load: avg=${avgImageLoadLatency.toFixed(2)}ms`);
        console.log(`📱 Total Processing: avg=${avgTotalProcessingLatency.toFixed(2)}ms, max=${maxTotalProcessingLatency.toFixed(1)}ms`);
        console.log(`📦 Avg Blob Size: ${(avgBlobSize/1024).toFixed(1)}KB`);
        
        // 生成性能建议
        const metrics = {
            avgFrameLatency,
            maxFrameLatency,
            avgTotalProcessingLatency,
            maxTotalProcessingLatency,
            actualFPS,
            avgBlobSize
        };
        
        this.generateOptimizationSuggestions(metrics);
        
        // 清空样本数据
        this.performanceData.samples = [];
    }
    
    // 按钮状态管理方法（如果不存在的话）
    setButtonState(button, state) {
        if (!button) return;
        
        // 移除所有状态类
        button.classList.remove('active', 'processing');
        
        // 添加新状态
        if (state === 'active') {
            button.classList.add('active');
        } else if (state === 'processing') {
            button.classList.add('processing');
        }
    }
    
    // 修复：相机标定UI状态更新方法
    updateCameraCalibrationUIWithStates() {
        // 基本的UI状态初始化
        console.log('📋 [UI] Initializing camera calibration UI states...');
        
        // 初始化按钮状态
        if (this.toggleCameraCalibrationBtn) {
            this.toggleCameraCalibrationBtn.disabled = false;
        }
        
        if (this.addCalibrationImageBtn) {
            this.addCalibrationImageBtn.disabled = true; // 默认禁用，需要在标定模式下启用
        }
        
        if (this.performCameraCalibrationBtn) {
            this.performCameraCalibrationBtn.disabled = true;
        }
        
        if (this.saveCameraCalibrationBtn) {
            this.saveCameraCalibrationBtn.disabled = true;
        }
        
        if (this.downloadCameraCalibrationBtn) {
            this.downloadCameraCalibrationBtn.disabled = !this.cameraCalibrated; // 根据标定状态启用/禁用
        }
        
        if (this.startAutoCalibrationBtn) {
            this.startAutoCalibrationBtn.disabled = true;
        }
        
        if (this.stopAutoCalibrationBtn) {
            this.stopAutoCalibrationBtn.disabled = true;
        }
        
        console.log('✅ [UI] Camera calibration UI states initialized');
    }
    
    // 修复：加载相机标定数据
    loadCameraCalibration() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.error('WebSocket not connected');
            this.updateStatus('error', 'WebSocket not connected');
            return;
        }
        
        // 设置处理状态
        this.setButtonState(this.loadCameraCalibrationBtn, 'processing');
        
        const message = {
            action: 'load_camera_calibration'
        };
        
        console.log('📤 [CALIBRATION] Loading calibration data:', message);
        this.ws.send(JSON.stringify(message));
        
        if (this.lastOperation) {
            this.lastOperation.textContent = 'Loading calibration data';
        }
        
        // 3秒后恢复按钮状态
        setTimeout(() => {
            this.setButtonState(this.loadCameraCalibrationBtn, '');
        }, 3000);
    }
    
    // 修复：添加标定图像
    addCalibrationImage() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.error('WebSocket not connected');
            this.updateStatus('error', 'WebSocket not connected');
            return;
        }
        
        // 设置处理状态
        this.setButtonState(this.addCalibrationImageBtn, 'processing');
        
        const message = {
            action: 'add_calibration_image'
        };
        
        console.log('📤 [CALIBRATION] Adding calibration image:', message);
        this.ws.send(JSON.stringify(message));
        
        if (this.lastOperation) {
            this.lastOperation.textContent = 'Capturing calibration image';
        }
        
        // 2秒后恢复按钮状态
        setTimeout(() => {
            this.setButtonState(this.addCalibrationImageBtn, '');
        }, 2000);
    }
    
    // 修复：执行相机标定
    performCameraCalibration() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.error('WebSocket not connected');
            this.updateStatus('error', 'WebSocket not connected');
            return;
        }
        
        // 设置处理状态
        this.setButtonState(this.performCameraCalibrationBtn, 'processing');
        
        const message = {
            action: 'perform_camera_calibration'
        };
        
        console.log('📤 [CALIBRATION] Performing camera calibration:', message);
        this.ws.send(JSON.stringify(message));
        
        if (this.lastOperation) {
            this.lastOperation.textContent = 'Performing camera calibration';
        }
    }
    
    // 修复：保存相机标定结果
    saveCameraCalibration() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.error('WebSocket not connected');
            this.updateStatus('error', 'WebSocket not connected');
            return;
        }
        
        // 设置处理状态
        this.setButtonState(this.saveCameraCalibrationBtn, 'processing');
        
        const message = {
            action: 'save_camera_calibration'
        };
        
        console.log('📤 [CALIBRATION] Saving calibration result:', message);
        this.ws.send(JSON.stringify(message));
        
        if (this.lastOperation) {
            this.lastOperation.textContent = 'Saving calibration result';
        }
        
        // 2秒后恢复按钮状态
        setTimeout(() => {
            this.setButtonState(this.saveCameraCalibrationBtn, '');
        }, 2000);
    }
    
    // 修复：设置棋盘格参数
    setBoardSize() {
        const width = parseInt(this.boardWidthInput?.value) || 8;
        const height = parseInt(this.boardHeightInput?.value) || 5;
        const squareSize = (parseFloat(this.squareSizeInput?.value) || 30) / 1000.0; // 转换为米
        const blurKernelSize = parseInt(this.blurKernelSizeInput?.value) || 5;
        const qualityCheckLevel = parseInt(this.qualityCheckLevelInput?.value) || 1;

        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            const message = {
                action: 'set_board_size',
                width: width,
                height: height,
                square_size: squareSize,
                blur_kernel_size: blurKernelSize,
                quality_check_level: qualityCheckLevel
            };
            this.ws.send(JSON.stringify(message));
            
            const statusText = window.i18n ? 
                `已设置棋盘格: ${width}×${height}, 方格大小: ${squareSize*1000}mm, 模糊核: ${blurKernelSize}×${blurKernelSize}, 质量级别: ${['严格','平衡','宽松'][qualityCheckLevel]}` :
                `Board size set: ${width}×${height}, square: ${squareSize*1000}mm, blur: ${blurKernelSize}×${blurKernelSize}, quality: ${['Strict','Balanced','Permissive'][qualityCheckLevel]}`;
            this.updateStatus('success', statusText);
        } else {
            this.updateStatus('error', window.i18n ? window.i18n.t('websocket_not_connected') : 'WebSocket not connected');
        }
    }
    
    // 修复：开始/停止流
    start() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                action: 'start_stream'
            }));
        }
    }
    
    stop() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                action: 'stop_stream'
            }));
        }
    }
    
    // 修复：全屏切换 - 改为视频全屏
    toggleFullscreen() {
        const video = document.getElementById('videoImage');
        if (!video) {
            console.error('视频元素未找到');
            return;
        }
        
        if (!document.fullscreenElement) {
            // 进入视频全屏
            if (video.requestFullscreen) {
                video.requestFullscreen().catch(err => {
                    console.error(`无法进入视频全屏模式: ${err.message}`);
                    this.showErrorToast('全屏失败', '无法进入视频全屏模式，请检查浏览器权限', 'error', 3000);
                });
            } else if (video.mozRequestFullScreen) {
                video.mozRequestFullScreen();
            } else if (video.webkitRequestFullscreen) {
                video.webkitRequestFullscreen();
            } else if (video.msRequestFullscreen) {
                video.msRequestFullscreen();
            } else {
                console.error('浏览器不支持视频全屏');
                this.showErrorToast('不支持全屏', '当前浏览器不支持视频全屏功能', 'warning', 3000);
            }
            
            // 如果在标定模式下进入全屏，显示提示
            if (this.calibrationMode) {
                setTimeout(() => {
                    this.showFullscreenCalibrationTip();
                }, 500);
            }
        } else {
            // 退出全屏
            if (document.exitFullscreen) {
                document.exitFullscreen().catch(err => {
                    console.error(`退出全屏失败: ${err.message}`);
                });
            }
        }
    }
    
    // 显示全屏标定提示
    showFullscreenCalibrationTip() {
        // 创建提示元素
        const tip = document.createElement('div');
        tip.className = 'fullscreen-calibration-tip';
        tip.innerHTML = `
            🎯 全屏标定模式（1920×1080）<br/>
            点击格子交叉点进行标定<br/>
            <small>ESC退出全屏 | F11切换全屏</small>
        `;
        
        document.body.appendChild(tip);
        
        // 4秒后淡出
        setTimeout(() => {
            tip.classList.add('fade-out');
            setTimeout(() => {
                if (tip.parentNode) {
                    tip.parentNode.removeChild(tip);
                }
            }, 500);
        }, 4000);
    }
    
    // 修复：发送消息的通用方法
    send(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            console.log('📤 [WEBSOCKET] Sending message:', data);
            this.ws.send(JSON.stringify(data));
            
            // Update last operation information
            if (this.lastOperation) {
                this.lastOperation.textContent = `Sent command: ${data.action}`;
            }
        } else {
            console.error('WebSocket not connected');
            this.updateStatus('error', 'WebSocket not connected');
        }
    }
    
    // 修复：处理相机标定加载响应
    handleCameraCalibrationLoaded(data) {
        // 恢复按钮状态
        this.setButtonState(this.loadCameraCalibrationBtn, '');
        
        if (data.success) {
            this.updateStatus('success', 'Camera calibration loaded successfully');
            
            // 更新UI状态表示已标定
            this.cameraCalibrated = true;
            this.updateCameraCalibrationUIWithStates();
            
            // 启用相机校正开关
            if (this.enableCameraCorrectionToggle) {
                this.enableCameraCorrectionToggle.disabled = false;
                
                // 🔧 修复：根据后端响应同步校正状态
                const correctionEnabled = data.correction_enabled || false;
                this.enableCameraCorrectionToggle.checked = correctionEnabled;
                this.updateCorrectionStatus(correctionEnabled ? 'active' : 'inactive');
                
                console.log(`📸 [CAMERA CORRECTION] Synced with backend state: ${correctionEnabled ? 'enabled' : 'disabled'}`);
                
                // 同步浮动面板状态
                if (this.floatingEnableCameraCorrectionToggle) {
                    this.floatingEnableCameraCorrectionToggle.checked = correctionEnabled;
                    this.floatingEnableCameraCorrectionToggle.disabled = false;
                }
                this.updateFloatingCorrectionStatus(correctionEnabled ? 'active' : 'inactive');
            }
            
            // 显示加载的标定信息
            this.displayLoadedCalibrationResults(data);
        } else {
            this.updateStatus('error', data.error || 'Failed to load camera calibration');
        }
    }
    
    // 修复：处理相机标定保存响应
    handleCameraCalibrationSaved(data) {
        // 恢复按钮状态
        this.setButtonState(this.saveCameraCalibrationBtn, '');
        
        if (data.success) {
            this.updateStatus('success', 'Camera calibration saved successfully');
            
            // 显示详细的标定信息
            this.displayCalibrationResults(data);
        } else {
            this.updateStatus('error', data.error || 'Failed to save camera calibration');
        }
    }
    
    // 修复：显示标定结果
    displayCalibrationResults(data) {
        // 创建或更新调试信息面板
        let debugPanel = document.getElementById('calibration-debug-panel');
        if (!debugPanel) {
            debugPanel = document.createElement('div');
            debugPanel.id = 'calibration-debug-panel';
            debugPanel.className = 'calibration-debug-panel';
            debugPanel.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: white;
                border: 2px solid #007bff;
                border-radius: 10px;
                padding: 20px;
                max-width: 600px;
                max-height: 70vh;
                overflow-y: auto;
                z-index: 1000;
                box-shadow: 0 4px 8px rgba(0,0,0,0.3);
                font-family: 'Courier New', monospace;
                font-size: 12px;
            `;
            document.body.appendChild(debugPanel);
        }
        
        let html = `
            <div style="text-align: center; margin-bottom: 15px;">
                <h3 style="color: #007bff; margin: 0;">📊 ${window.i18n.t('camera_calibration_results')}</h3>
                <button onclick="document.getElementById('calibration-debug-panel').remove()" 
                        style="position: absolute; top: 10px; right: 15px; background: #dc3545; color: white; border: none; border-radius: 50%; width: 25px; height: 25px; cursor: pointer;">×</button>
            </div>
            
            <div style="margin-bottom: 15px;">
                <h4 style="color: #28a745; margin: 5px 0;">✅ ${window.i18n.t('calibration_success')}</h4>
                <p><strong>${window.i18n.t('calibration_image_count')}:</strong> ${data.image_count || 'N/A'}</p>
                <p><strong>${window.i18n.t('reprojection_error')}:</strong> ${data.error ? data.error.toFixed(4) : 'N/A'} ${window.i18n.t('pixels')}</p>
                <p><strong>${window.i18n.t('calibration_quality')}:</strong> <span style="color: ${this.getQualityColor(data.quality)}">${this.getQualityText(data.quality)}</span></p>
                ${this.getQualityAnalysis(data.error, data.image_count)}
                <p><strong>${window.i18n.t('save_path')}:</strong> <code>${data.filepath || 'N/A'}</code></p>
            </div>
        `;
        
        if (data.camera_matrix) {
            html += `
                <div style="margin-bottom: 15px;">
                    <h4 style="color: #17a2b8; margin: 5px 0;">📐 ${window.i18n.t('camera_matrix')}</h4>
                    <div style="background: #f8f9fa; padding: 10px; border-radius: 5px; font-family: monospace;">
                        <table style="margin: 0 auto; border-spacing: 10px;">
                            <tr>
                                <td>${data.camera_matrix[0]?.toFixed(2) || 'N/A'}</td>
                                <td>${data.camera_matrix[1]?.toFixed(2) || 'N/A'}</td>
                                <td>${data.camera_matrix[2]?.toFixed(2) || 'N/A'}</td>
                            </tr>
                            <tr>
                                <td>${data.camera_matrix[3]?.toFixed(2) || 'N/A'}</td>
                                <td>${data.camera_matrix[4]?.toFixed(2) || 'N/A'}</td>
                                <td>${data.camera_matrix[5]?.toFixed(2) || 'N/A'}</td>
                            </tr>
                            <tr>
                                <td>${data.camera_matrix[6]?.toFixed(6) || 'N/A'}</td>
                                <td>${data.camera_matrix[7]?.toFixed(6) || 'N/A'}</td>
                                <td>${data.camera_matrix[8]?.toFixed(6) || 'N/A'}</td>
                            </tr>
                        </table>
                    </div>
                    <p style="font-size: 11px; color: #6c757d; margin-top: 5px;">
                        fx=${data.camera_matrix[0]?.toFixed(1) || 'N/A'}, fy=${data.camera_matrix[4]?.toFixed(1) || 'N/A'}, 
                        cx=${data.camera_matrix[2]?.toFixed(1) || 'N/A'}, cy=${data.camera_matrix[5]?.toFixed(1) || 'N/A'}
                    </p>
                </div>
            `;
        }
        
        if (data.distortion_coeffs) {
            html += `
                <div style="margin-bottom: 15px;">
                    <h4 style="color: #6f42c1; margin: 5px 0;">🔧 ${window.i18n.t('distortion_coefficients')}</h4>
                    <div style="background: #f8f9fa; padding: 10px; border-radius: 5px; font-family: monospace;">
                        [${data.distortion_coeffs.map(c => c.toFixed(6)).join(', ')}]
                    </div>
                    <p style="font-size: 11px; color: #6c757d; margin-top: 5px;">
                        k1=${data.distortion_coeffs[0]?.toFixed(4) || 'N/A'}, 
                        k2=${data.distortion_coeffs[1]?.toFixed(4) || 'N/A'}, 
                        p1=${data.distortion_coeffs[2]?.toFixed(4) || 'N/A'}, 
                        p2=${data.distortion_coeffs[3]?.toFixed(4) || 'N/A'}
                        ${data.distortion_coeffs[4] !== undefined ? `, k3=${data.distortion_coeffs[4].toFixed(4)}` : ''}
                    </p>
                </div>
            `;
        }
        
        html += `
            <div style="text-align: center; margin-top: 20px;">
                <button onclick="document.getElementById('calibration-debug-panel').remove()" 
                        style="background: #007bff; color: white; border: none; padding: 8px 16px; border-radius: 5px; cursor: pointer;">
                    ${window.i18n.t('close')}
                </button>
            </div>
        `;
        
        debugPanel.innerHTML = html;
    }
    
    // 修复：显示加载的标定结果
    displayLoadedCalibrationResults(data) {
        // 创建或更新调试信息面板
        let debugPanel = document.getElementById('calibration-debug-panel');
        if (!debugPanel) {
            debugPanel = document.createElement('div');
            debugPanel.id = 'calibration-debug-panel';
            debugPanel.className = 'calibration-debug-panel';
            debugPanel.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: white;
                border: 2px solid #28a745;
                border-radius: 10px;
                padding: 20px;
                max-width: 600px;
                max-height: 70vh;
                overflow-y: auto;
                z-index: 1000;
                box-shadow: 0 4px 8px rgba(0,0,0,0.3);
                font-family: 'Courier New', monospace;
                font-size: 12px;
            `;
            document.body.appendChild(debugPanel);
        }
        
        let html = `
            <div style="text-align: center; margin-bottom: 15px;">
                <h3 style="color: #28a745; margin: 0;">📁 ${window.i18n.t('calibration_data_loaded')}</h3>
                <button onclick="document.getElementById('calibration-debug-panel').remove()" 
                        style="position: absolute; top: 10px; right: 15px; background: #dc3545; color: white; border: none; border-radius: 50%; width: 25px; height: 25px; cursor: pointer;">×</button>
            </div>
            
            <div style="margin-bottom: 15px;">
                <h4 style="color: #28a745; margin: 5px 0;">✅ ${window.i18n.t('calibration_data_load_success')}</h4>
                <p><strong>${window.i18n.t('reprojection_error')}:</strong> ${data.error ? data.error.toFixed(4) : 'N/A'} ${window.i18n.t('pixels')}</p>
                <p><strong>${window.i18n.t('calibration_quality')}:</strong> <span style="color: ${this.getQualityColor(data.quality)}">${this.getQualityText(data.quality)}</span></p>
                <p><strong>${window.i18n.t('file_path')}:</strong> <code>${data.filepath || 'N/A'}</code></p>
                <div style="background: #d4edda; padding: 8px; border-radius: 5px; color: #155724; font-size: 11px;">
                    ℹ️ ${window.i18n.t('calibration_activated_info')}
                </div>
            </div>
        `;
        
        if (data.camera_matrix) {
            html += `
                <div style="margin-bottom: 15px;">
                    <h4 style="color: #17a2b8; margin: 5px 0;">📐 ${window.i18n.t('camera_matrix')}</h4>
                    <div style="background: #f8f9fa; padding: 10px; border-radius: 5px; font-family: monospace;">
                        <table style="margin: 0 auto; border-spacing: 10px;">
                            <tr>
                                <td>${data.camera_matrix[0]?.toFixed(2) || 'N/A'}</td>
                                <td>${data.camera_matrix[1]?.toFixed(2) || 'N/A'}</td>
                                <td>${data.camera_matrix[2]?.toFixed(2) || 'N/A'}</td>
                            </tr>
                            <tr>
                                <td>${data.camera_matrix[3]?.toFixed(2) || 'N/A'}</td>
                                <td>${data.camera_matrix[4]?.toFixed(2) || 'N/A'}</td>
                                <td>${data.camera_matrix[5]?.toFixed(2) || 'N/A'}</td>
                            </tr>
                            <tr>
                                <td>${data.camera_matrix[6]?.toFixed(6) || 'N/A'}</td>
                                <td>${data.camera_matrix[7]?.toFixed(6) || 'N/A'}</td>
                                <td>${data.camera_matrix[8]?.toFixed(6) || 'N/A'}</td>
                            </tr>
                        </table>
                    </div>
                    <p style="font-size: 11px; color: #6c757d; margin-top: 5px;">
                        fx=${data.camera_matrix[0]?.toFixed(1) || 'N/A'}, fy=${data.camera_matrix[4]?.toFixed(1) || 'N/A'}, 
                        cx=${data.camera_matrix[2]?.toFixed(1) || 'N/A'}, cy=${data.camera_matrix[5]?.toFixed(1) || 'N/A'}
                    </p>
                </div>
            `;
        }
        
        if (data.distortion_coeffs) {
            html += `
                <div style="margin-bottom: 15px;">
                    <h4 style="color: #6f42c1; margin: 5px 0;">🔧 ${window.i18n.t('distortion_coefficients')}</h4>
                    <div style="background: #f8f9fa; padding: 10px; border-radius: 5px; font-family: monospace;">
                        [${data.distortion_coeffs.map(c => c.toFixed(6)).join(', ')}]
                    </div>
                    <p style="font-size: 11px; color: #6c757d; margin-top: 5px;">
                        k1=${data.distortion_coeffs[0]?.toFixed(4) || 'N/A'}, 
                        k2=${data.distortion_coeffs[1]?.toFixed(4) || 'N/A'}, 
                        p1=${data.distortion_coeffs[2]?.toFixed(4) || 'N/A'}, 
                        p2=${data.distortion_coeffs[3]?.toFixed(4) || 'N/A'}
                        ${data.distortion_coeffs[4] !== undefined ? `, k3=${data.distortion_coeffs[4].toFixed(4)}` : ''}
                    </p>
                </div>
            `;
        }
        
        html += `
            <div style="text-align: center; margin-top: 20px;">
                <button onclick="document.getElementById('calibration-debug-panel').remove()" 
                        style="background: #28a745; color: white; border: none; padding: 8px 16px; border-radius: 5px; cursor: pointer;">
                    关闭
                </button>
            </div>
        `;
        
        debugPanel.innerHTML = html;
    }
    
    // 修复：质量颜色和文本方法
    getQualityColor(quality) {
        switch(quality) {
            case 'EXCELLENT': return '#28a745';
            case 'GOOD': return '#007bff';
            case 'NEEDS_IMPROVEMENT': return '#ffc107';
            default: return '#6c757d';
        }
    }
    
    getQualityText(quality) {
        switch(quality) {
            case 'EXCELLENT': return '🌟 优秀';
            case 'GOOD': return '👍 良好';
            case 'NEEDS_IMPROVEMENT': return '⚠️ 需要改进';
            default: return '❓ 未知';
        }
    }
    
    getQualityAnalysis(error, imageCount) {
        if (!error && !imageCount) return '';
        
        let analysis = '<div style="margin: 10px 0; padding: 10px; background: #f8f9fa; border-radius: 5px; font-size: 11px;">';
        analysis += '<strong>📋 质量分析:</strong><br>';
        
        // 误差分析
        if (error) {
            if (error < 1.0) {
                analysis += '• <span style="color: #28a745;">误差优秀</span>: 适用于高精度测量应用<br>';
            } else if (error < 2.0) {
                analysis += '• <span style="color: #007bff;">误差良好</span>: 适用于一般工业应用<br>';
            } else {
                analysis += '• <span style="color: #dc3545;">误差偏高</span>: 建议重新标定以提高精度<br>';
                analysis += '• <strong>改进建议:</strong> 确保图像清晰、光照均匀、拍摄角度多样化<br>';
            }
        }
        
        // 图像数量分析
        if (imageCount) {
            if (imageCount >= 20) {
                analysis += '• <span style="color: #28a745;">图像数量充足</span>: ' + imageCount + '张图像能够提供良好的标定基础<br>';
            } else if (imageCount >= 10) {
                analysis += '• <span style="color: #ffc107;">图像数量适中</span>: ' + imageCount + '张图像基本满足标定需求<br>';
            } else {
                analysis += '• <span style="color: #dc3545;">图像数量偏少</span>: 建议增加到15-25张图像<br>';
            }
        }
        
        analysis += '</div>';
        return analysis;
    }

    // ===== ArUco 相关方法 =====
    
    toggleArUcoMode() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.error('WebSocket not connected');
            this.updateStatus('error', 'WebSocket not connected');
            return;
        }

        const message = {
            action: 'toggle_aruco_mode'
        };

        this.send(message);
        console.log('[ArUco] 切换ArUco模式...');
    }

    calibrateFromArUcoMarkers() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.error('WebSocket not connected');
            return;
        }

        const message = {
            action: 'calibrate_from_aruco_markers'
        };

        this.send(message);
        console.log('[ArUco] 从ArUco标记进行标定...');
    }

    setMarkerCoordinates() {
        const markerIdInput = document.getElementById('markerId');
        const markerGroundXInput = document.getElementById('markerGroundX');
        const markerGroundYInput = document.getElementById('markerGroundY');

        if (!markerIdInput || !markerGroundXInput || !markerGroundYInput) {
            console.error('ArUco marker coordinate input elements not found');
            return;
        }

        const markerId = parseInt(markerIdInput.value);
        const x = parseFloat(markerGroundXInput.value);
        const y = parseFloat(markerGroundYInput.value);

        if (isNaN(markerId) || isNaN(x) || isNaN(y)) {
            alert('请输入有效的标记ID和坐标值');
            return;
        }

        const message = {
            action: 'set_marker_coordinates',
            marker_id: markerId,
            x: x,
            y: y
        };

        this.send(message);
        console.log(`[ArUco] 设置标记 ${markerId} 坐标: (${x}, ${y})`);
    }

    setMarkerCoordinatesInline() {
        const markerIdInput = document.getElementById('markerIdInline');
        const markerGroundXInput = document.getElementById('markerGroundXInline');
        const markerGroundYInput = document.getElementById('markerGroundYInline');

        if (!markerIdInput || !markerGroundXInput || !markerGroundYInput) {
            console.error('内联标记坐标输入元素未找到');
            return;
        }

        const markerId = parseInt(markerIdInput.value);
        const x = parseFloat(markerGroundXInput.value);
        const y = parseFloat(markerGroundYInput.value);

        if (isNaN(markerId) || isNaN(x) || isNaN(y)) {
            alert('请输入有效的标记ID和坐标值');
            return;
        }

        // 更新本地存储
        if (!this.markerCoordinates) {
            this.markerCoordinates = {};
        }
        this.markerCoordinates[markerId] = { x: x, y: y };

        const message = {
            action: 'set_marker_coordinates',
            marker_id: markerId,
            x: x,
            y: y
        };

        this.send(message);
        console.log(`[ArUco] 内联设置标记 ${markerId} 坐标: (${x}, ${y})`);
        
        // 更新快速显示列表
        this.updateMarkersQuickDisplay();
        
        // 显示成功提示
        this.showTemporaryMessage(`标记 ${markerId} 坐标已设置: (${x}, ${y})`, 'success');
        
        // 清空输入框（可选）
        markerIdInput.value = parseInt(markerIdInput.value) + 1; // 自动递增ID
        markerGroundXInput.value = 0;
        markerGroundYInput.value = 0;
    }

    updateMarkersQuickDisplay() {
        const quickList = document.getElementById('markersQuickList');
        if (!quickList) return;

        if (!this.markerCoordinates || Object.keys(this.markerCoordinates).length === 0) {
            quickList.textContent = '暂无标记';
            return;
        }

        const markers = Object.entries(this.markerCoordinates)
            .map(([id, coord]) => `ID${id}:(${coord.x},${coord.y})`)
            .join(', ');
        
        quickList.textContent = markers;
        
        // 添加动画效果
        quickList.style.backgroundColor = 'rgba(40, 167, 69, 0.1)';
        quickList.style.color = 'rgba(40, 167, 69, 0.8)';
        setTimeout(() => {
            quickList.style.backgroundColor = 'rgba(255, 255, 255, 0.6)';
            quickList.style.color = 'rgba(73, 80, 87, 0.7)';
        }, 1000);
    }

    saveMarkerCoordinates() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.error('WebSocket not connected');
            return;
        }

        const message = {
            action: 'save_marker_coordinates'
        };

        this.send(message);
        console.log('[ArUco] 保存标记坐标...');
    }

    loadMarkerCoordinates() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.error('WebSocket not connected');
            return;
        }

        const message = {
            action: 'load_marker_coordinates'
        };

        this.send(message);
        console.log('[ArUco] 加载标记坐标...');
    }

    // 处理ArUco相关的WebSocket消息
    handleArUcoModeStatus(data) {
        console.log('🎯 [ARUCO TESTING] 测试模式状态更新:', data);
        
        const arucoTestingStatus = document.getElementById('arucoTestingStatus');
        const arucoPanel = document.getElementById('arucoPanel');
        const detectionStatusDisplay = document.getElementById('detectionStatusDisplay');
        const matrixStatusDisplay = document.getElementById('matrixStatusDisplay');
        
        if (data.enabled || data.aruco_mode) {
            // 启用ArUco测试模式
            console.log('🎯 [ARUCO TESTING] 测试模式已启用');
            
            if (this.toggleArUcoBtn) {
                const span = this.toggleArUcoBtn.querySelector('span');
                const disableText = window.i18n ? window.i18n.t('disable_aruco_testing') : '禁用 ArUco 测试';
                if (span) {
                    span.textContent = disableText;
                } else {
                    this.toggleArUcoBtn.textContent = disableText;
                }
                this.toggleArUcoBtn.classList.remove('btn-primary');
                this.toggleArUcoBtn.classList.add('btn-danger');
            }
            
            if (arucoTestingStatus) {
                arucoTestingStatus.style.display = 'block';
            }
            
            if (arucoPanel) {
                arucoPanel.style.display = 'block';
                console.log('🎯 [ARUCO TESTING] ArUco面板已显示');
            }
            
            // 隐藏其他面板
            const calibrationPanel = document.getElementById('calibrationPanel');
            const coordinateTestPanel = document.getElementById('coordinateTestPanel');
            if (calibrationPanel) calibrationPanel.style.display = 'none';
            if (coordinateTestPanel) coordinateTestPanel.style.display = 'none';
            
            if (detectionStatusDisplay) {
                detectionStatusDisplay.textContent = window.i18n ? window.i18n.t('test_mode_running') : '测试模式运行中';
                detectionStatusDisplay.classList.add('status-active');
            }
            
            // 检查矩阵状态
            if (data.homography_loaded) {
                if (matrixStatusDisplay) {
                    matrixStatusDisplay.textContent = window.i18n ? window.i18n.t('calibrated') : '已标定';
                    matrixStatusDisplay.classList.remove('matrix-not-ready');
                    matrixStatusDisplay.classList.add('matrix-ready');
                }
                const successMsg = window.i18n ? window.i18n.t('aruco_test_enabled_matrix_loaded') : 'ArUco测试模式已启用，单应性矩阵已加载';
                this.updateStatus('success', successMsg);
            } else {
                if (matrixStatusDisplay) {
                    matrixStatusDisplay.textContent = window.i18n ? window.i18n.t('not_calibrated') : '未标定';
                    matrixStatusDisplay.classList.remove('matrix-ready');
                    matrixStatusDisplay.classList.add('matrix-not-ready');
                }
                const warningMsg = window.i18n ? window.i18n.t('aruco_test_enabled_no_matrix') : 'ArUco测试模式已启用，但未检测到单应性矩阵';
                this.updateStatus('warning', warningMsg);
            }
            
        } else {
            // 禁用ArUco测试模式
            console.log('🎯 [ARUCO TESTING] 测试模式已禁用');
            
            if (this.toggleArUcoBtn) {
                const span = this.toggleArUcoBtn.querySelector('span');
                const enableText = window.i18n ? window.i18n.t('enable_aruco_testing') : '启用 ArUco 测试';
                if (span) {
                    span.textContent = enableText;
                } else {
                    this.toggleArUcoBtn.textContent = enableText;
                }
                this.toggleArUcoBtn.classList.remove('btn-danger');
                this.toggleArUcoBtn.classList.add('btn-primary');
            }
            
            if (arucoTestingStatus) {
                arucoTestingStatus.style.display = 'none';
            }
            
            if (arucoPanel) {
                arucoPanel.style.display = 'none';
                console.log('🎯 [ARUCO TESTING] ArUco面板已隐藏');
            }
            
            if (detectionStatusDisplay) {
                detectionStatusDisplay.textContent = window.i18n ? window.i18n.t('waiting_detection') : '等待检测';
                detectionStatusDisplay.classList.remove('status-active');
            }
            
            const disabledMsg = window.i18n ? window.i18n.t('aruco_test_disabled') : 'ArUco测试模式已禁用';
            this.updateStatus('info', disabledMsg);
        }
        
        // 更新检测到的标记数量
        if (data.detected_markers !== undefined) {
            const detectedMarkersTestCount = document.getElementById('detectedMarkersTestCount');
            if (detectedMarkersTestCount) {
                detectedMarkersTestCount.textContent = data.detected_markers;
            }
            
            // 更新检测结果显示
            this.updateArUcoTestingResults(data);
        }
    }

    // 处理ArUco实时检测更新
    handleArUcoDetectionUpdate(data) {
        console.log('📡 [ARUCO DETECTION] 实时更新:', data);
        
        // 更新检测到的标记数量（主状态区）
        const detectedMarkersTestCount = document.getElementById('detectedMarkersTestCount');
        if (detectedMarkersTestCount && data.detected_markers !== undefined) {
            detectedMarkersTestCount.textContent = data.detected_markers;
            console.log('📊 [ARUCO UPDATE] 标记数量更新:', data.detected_markers);
        }
        
        // 更新矩阵状态
        const matrixStatusDisplay = document.getElementById('matrixStatusDisplay');
        const homographyStatusTest = document.getElementById('homographyStatusTest');
        
        if (data.matrix_status && matrixStatusDisplay) {
            matrixStatusDisplay.textContent = data.matrix_status;
            matrixStatusDisplay.classList.remove('matrix-ready', 'matrix-not-ready');
            matrixStatusDisplay.classList.add(data.homography_loaded ? 'matrix-ready' : 'matrix-not-ready');
        }
        
        if (data.matrix_status && homographyStatusTest) {
            homographyStatusTest.textContent = data.matrix_status;
        }
        
        // 更新检测状态
        const detectionStatusDisplay = document.getElementById('detectionStatusDisplay');
        if (detectionStatusDisplay) {
            if (data.detected_markers > 0) {
                const detectedText = window.i18n ? 
                    window.i18n.t('detected_markers').replace('{count}', data.detected_markers) : 
                    `检测到 ${data.detected_markers} 个标记`;
                detectionStatusDisplay.textContent = detectedText;
                detectionStatusDisplay.classList.remove('status-active');
                detectionStatusDisplay.classList.add('detecting-found');
            } else {
                detectionStatusDisplay.textContent = window.i18n ? window.i18n.t('searching_markers') : '搜索标记中...';
                detectionStatusDisplay.classList.remove('detecting-found');
                detectionStatusDisplay.classList.add('status-active');
            }
        }
        
        // 如果包含标记详细信息，也更新检测结果列表
        if (data.markers !== undefined) {
            console.log('📍 [ARUCO MARKERS] 更新标记详细信息:', data.markers);
            this.updateArUcoTestingResults(data);
        }
    }

    handleMarkerCoordinatesSet(data) {
        if (data.success) {
            const successMsg = window.i18n ? window.i18n.t('marker_coordinates_set_success') : '标记坐标设置成功';
            this.updateStatus('success', successMsg);
            // 更新快速显示列表
            if (data.marker_id !== undefined && data.x !== undefined && data.y !== undefined) {
                if (!this.markerCoordinates) {
                    this.markerCoordinates = {};
                }
                this.markerCoordinates[data.marker_id] = { x: data.x, y: data.y };
                this.updateMarkersQuickDisplay();
            }
        } else {
            const failedMsg = window.i18n ? window.i18n.t('marker_coordinates_set_failed') : '标记坐标设置失败';
            this.updateStatus('error', failedMsg);
        }
    }

    handleMarkerCoordinatesSaved(data) {
        if (data.success) {
            const successMsg = window.i18n ? window.i18n.t('marker_coordinates_saved_success') : '标记坐标保存成功';
            this.updateStatus('success', successMsg);
        } else {
            const failedMsg = window.i18n ? window.i18n.t('marker_coordinates_saved_failed') : '标记坐标保存失败';
            this.updateStatus('error', failedMsg);
        }
    }

    handleMarkerCoordinatesLoaded(data) {
        if (data.success) {
            const successMsg = window.i18n ? window.i18n.t('marker_coordinates_loaded_success') : '标记坐标加载成功';
            this.updateStatus('success', successMsg);
        } else {
            const failedMsg = window.i18n ? window.i18n.t('marker_coordinates_loaded_failed') : '标记坐标加载失败';
            this.updateStatus('error', failedMsg);
        }
    }

    // ArUco 检测参数设置方法
    setArUcoDetectionParameters() {
        const minSizeInput = document.getElementById('arucoAdaptiveThreshWinSizeMin');
        const maxSizeInput = document.getElementById('arucoAdaptiveThreshWinSizeMax');
        const stepInput = document.getElementById('arucoAdaptiveThreshWinSizeStep');
        const constantInput = document.getElementById('arucoAdaptiveThreshConstant');
        const refinementInput = document.getElementById('arucoCornerRefinementMethod');

        if (!minSizeInput || !maxSizeInput || !stepInput || !constantInput || !refinementInput) {
            console.error('ArUco detection parameter input elements not found');
            return;
        }

        const minSize = parseInt(minSizeInput.value);
        const maxSize = parseInt(maxSizeInput.value);
        const step = parseInt(stepInput.value);
        const constant = parseFloat(constantInput.value);
        const refinement = parseInt(refinementInput.value);

        if (isNaN(minSize) || isNaN(maxSize) || isNaN(step) || isNaN(constant) || isNaN(refinement)) {
            alert('请输入有效的检测参数值');
            return;
        }

        if (minSize >= maxSize) {
            alert('最小窗口值必须小于最大窗口值');
            return;
        }

        const message = {
            action: 'set_aruco_detection_parameters',
            adaptiveThreshWinSizeMin: minSize,
            adaptiveThreshWinSizeMax: maxSize,
            adaptiveThreshWinSizeStep: step,
            adaptiveThreshConstant: constant,
            cornerRefinementMethod: refinement
        };

        this.send(message);
        console.log(`[ArUco] 设置检测参数: 窗口(${minSize}-${maxSize}), 步长(${step}), 常数(${constant}), 优化方法(${refinement})`);
        
        // 显示参数应用成功提示
        this.showTemporaryMessage('检测参数已应用，将在下一帧生效', 'success');
    }

    // 应用快速ArUco设置
    applyQuickArUcoSettings() {
        const sensitivitySelect = document.getElementById('arucoSensitivity');
        
        if (!sensitivitySelect) {
            console.error('ArUco sensitivity select not found');
            return;
        }

        const sensitivity = sensitivitySelect.value;
        let params = {};

        // 根据灵敏度预设参数
        switch (sensitivity) {
            case 'low':
                params = {
                    adaptiveThreshWinSizeMin: 5,
                    adaptiveThreshWinSizeMax: 25,
                    adaptiveThreshWinSizeStep: 5,
                    adaptiveThreshConstant: 7,
                    cornerRefinementMethod: 0
                };
                break;
            case 'medium':
                params = {
                    adaptiveThreshWinSizeMin: 3,
                    adaptiveThreshWinSizeMax: 35,
                    adaptiveThreshWinSizeStep: 5,
                    adaptiveThreshConstant: 5,
                    cornerRefinementMethod: 1
                };
                break;
            case 'high':
                params = {
                    adaptiveThreshWinSizeMin: 3,
                    adaptiveThreshWinSizeMax: 50,
                    adaptiveThreshWinSizeStep: 3,
                    adaptiveThreshConstant: 3,
                    cornerRefinementMethod: 2
                };
                break;
            default:
                console.error('Invalid sensitivity value:', sensitivity);
                return;
        }

        const message = {
            action: 'set_aruco_detection_parameters',
            ...params
        };

        this.send(message);
        console.log(`[ArUco] 应用${sensitivity}灵敏度设置:`, params);
        
        // 显示设置应用成功提示
        const sensitivityText = sensitivity === 'low' ? '低' : sensitivity === 'medium' ? '中' : '高';
        this.showTemporaryMessage(`已应用${sensitivityText}灵敏度检测设置`, 'success');
    }

    // 重置ArUco检测参数到默认值
    resetArUcoDetectionParameters() {
        // 设置为优化后的默认值
        document.getElementById('arucoAdaptiveThreshWinSizeMin').value = 3;
        document.getElementById('arucoAdaptiveThreshWinSizeMax').value = 35;
        document.getElementById('arucoAdaptiveThreshWinSizeStep').value = 5;
        document.getElementById('arucoAdaptiveThreshConstant').value = 5;
        document.getElementById('arucoCornerRefinementMethod').value = 1;
        
        // 应用默认参数
        this.setArUcoDetectionParameters();
        console.log('[ArUco] 检测参数已重置为默认值');
    }

    // 显示临时消息的辅助方法
    showTemporaryMessage(message, type = 'info') {
        // 创建消息元素
        const messageDiv = document.createElement('div');
        messageDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 6px;
            color: white;
            font-weight: 500;
            z-index: 10000;
            transition: opacity 0.3s ease;
        `;
        
        // 根据类型设置背景色
        switch (type) {
            case 'success':
                messageDiv.style.backgroundColor = '#28a745';
                break;
            case 'error':
                messageDiv.style.backgroundColor = '#dc3545';
                break;
            case 'warning':
                messageDiv.style.backgroundColor = '#ffc107';
                messageDiv.style.color = '#212529';
                break;
            default:
                messageDiv.style.backgroundColor = '#17a2b8';
                break;
        }
        
        messageDiv.textContent = message;
        document.body.appendChild(messageDiv);
        
        // 3秒后自动移除
        setTimeout(() => {
            messageDiv.style.opacity = '0';
            setTimeout(() => {
                if (messageDiv.parentNode) {
                    messageDiv.parentNode.removeChild(messageDiv);
                }
            }, 300);
        }, 3000);
    }

    // 操作指南面板相关方法
    showOperationGuide() {
        const guide = document.getElementById('operationGuide');
        if (guide) {
            guide.style.display = 'block';
        }
    }

    hideOperationGuide() {
        const guide = document.getElementById('operationGuide');
        if (guide) {
            guide.style.display = 'none';
        }
    }

    toggleOperationGuide() {
        const guidePanel = document.getElementById('operationGuidePanel');
        if (guidePanel) {
            const isVisible = guidePanel.style.display !== 'none';
            if (isVisible) {
                this.hideOperationGuide();
            } else {
                this.showOperationGuide();
            }
        }
    }
    
    // ========== 坐标变换标定相关方法 ==========
    
    // 切换坐标变换标定模式
    toggleCoordinateCalibrationMode() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.error('WebSocket not connected');
            this.updateStatus('error', 'WebSocket未连接');
            return;
        }

        const message = {
            action: 'toggle_calibration_mode'
        };

        console.log('📤 [COORDINATE CALIBRATION] 发送标定模式切换请求:', message);
        this.ws.send(JSON.stringify(message));

        // 更新最近操作信息
        if (this.lastOperation) {
            this.lastOperation.textContent = window.i18n ? window.i18n.t('switching_coordinate_calibration_mode') : '正在切换坐标标定模式...';
        }
    }

    // 处理视频图像点击事件（改进的坐标计算）
    handleVideoImageClick(event) {
        console.log('🖱️ [VIDEO IMAGE CLICK] 视频图像被点击');
        console.log('🖱️ [VIDEO IMAGE CLICK] 当前标定模式状态:', this.calibrationMode);
        
        // 只在坐标标定模式下处理点击
        if (!this.calibrationMode) {
            console.log('🖱️ [VIDEO IMAGE CLICK] 不在标定模式，忽略点击');
            return;
        }

        // 防止事件冒泡
        event.preventDefault();
        event.stopPropagation();

        const imgElement = event.target;
        const rect = imgElement.getBoundingClientRect();
        
        // 计算点击位置相对于图像的位置
        const clickX = event.clientX - rect.left;
        const clickY = event.clientY - rect.top;
        
        // 获取图像的显示尺寸和原始尺寸
        const displayWidth = imgElement.clientWidth;
        const displayHeight = imgElement.clientHeight;
        const naturalWidth = imgElement.naturalWidth || displayWidth;
        const naturalHeight = imgElement.naturalHeight || displayHeight;
        
        // 计算缩放比例
        const scaleX = naturalWidth / displayWidth;
        const scaleY = naturalHeight / displayHeight;
        
        // 转换为原始图像坐标
        const imageX = clickX * scaleX;
        const imageY = clickY * scaleY;

        console.log(`📍 [IMAGE CLICK] 显示尺寸: ${displayWidth}x${displayHeight}`);
        console.log(`📍 [IMAGE CLICK] 原始尺寸: ${naturalWidth}x${naturalHeight}`);
        console.log(`📍 [IMAGE CLICK] 缩放比例: ${scaleX.toFixed(2)}x${scaleY.toFixed(2)}`);
        console.log(`📍 [IMAGE CLICK] 点击位置(显示): (${clickX.toFixed(1)}, ${clickY.toFixed(1)})`);
        console.log(`📍 [IMAGE CLICK] 点击位置(原始): (${imageX.toFixed(1)}, ${imageY.toFixed(1)})`);

        // 显示坐标输入对话框
        this.showCoordinateInputDialog(imageX, imageY);
    }

    // 处理视频容器点击事件（添加标定点）
    handleVideoContainerClick(event) {
        console.log('🖱️ [VIDEO CLICK] 视频容器被点击');
        console.log('🖱️ [VIDEO CLICK] 当前标定模式状态:', this.calibrationMode);
        
        // 只在坐标标定模式下处理点击
        if (!this.calibrationMode) {
            console.log('🖱️ [VIDEO CLICK] 不在标定模式，忽略点击');
            return;
        }

        // 防止事件冒泡
        event.preventDefault();
        event.stopPropagation();

        const rect = this.videoContainer.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        console.log(`📍 [CALIBRATION POINT] 点击位置: (${x}, ${y})`);

        // 显示坐标输入对话框
        this.showCoordinateInputDialog(x, y);
    }

    // 显示坐标输入对话框
    showCoordinateInputDialog(imageX, imageY) {
        const groundXPrompt = window.i18n ? window.i18n.t('input_ground_x_prompt') : '请输入地面坐标 X (毫米):';
        const groundYPrompt = window.i18n ? window.i18n.t('input_ground_y_prompt') : '请输入地面坐标 Y (毫米):';
        
        const groundX = prompt(groundXPrompt, '0');
        if (groundX === null) return; // 用户取消

        const groundY = prompt(groundYPrompt, '0');
        if (groundY === null) return; // 用户取消

        const groundXFloat = parseFloat(groundX);
        const groundYFloat = parseFloat(groundY);

        if (isNaN(groundXFloat) || isNaN(groundYFloat)) {
            alert('请输入有效的数字坐标！');
            return;
        }

        // 发送添加标定点的请求
        this.addCalibrationPoint(imageX, imageY, groundXFloat, groundYFloat);
    }

    // 添加标定点
    addCalibrationPoint(imageX, imageY, groundX, groundY) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.error('WebSocket not connected');
            return;
        }

        const message = {
            action: 'add_calibration_point',
            image_x: imageX,
            image_y: imageY,
            ground_x: groundX,
            ground_y: groundY
        };

        console.log('📤 [ADD POINT] 发送添加标定点请求:', message);
        this.ws.send(JSON.stringify(message));

        // 更新本地标定点列表
        this.calibrationPoints.push({
            image: { x: imageX, y: imageY },
            ground: { x: groundX, y: groundY }
        });

        this.updateCalibrationPointsList();
        this.updateCalibrationStatus();

        // 更新最近操作信息
        if (this.lastOperation) {
            this.lastOperation.textContent = `添加标定点: 图像(${imageX.toFixed(1)}, ${imageY.toFixed(1)}) -> 地面(${groundX}, ${groundY})`;
        }
    }

    // 移除最后一个标定点
    removeLastCalibrationPoint() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.error('WebSocket not connected');
            return;
        }

        const message = {
            action: 'remove_last_calibration_point'
        };

        console.log('📤 [REMOVE POINT] 发送移除最后标定点请求:', message);
        this.ws.send(JSON.stringify(message));

        // 更新本地标定点列表
        if (this.calibrationPoints.length > 0) {
            const removedPoint = this.calibrationPoints.pop();
            console.log('🗑️ [REMOVE POINT] 移除点:', removedPoint);
            
            this.updateCalibrationPointsList();
            this.updateCalibrationStatus();

            // 更新最近操作信息
            if (this.lastOperation) {
                this.lastOperation.textContent = '移除了最后一个标定点';
            }
        }
    }

    // 清除所有标定点
    clearCalibrationPoints() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.error('WebSocket not connected');
            return;
        }

        const message = {
            action: 'clear_calibration_points'
        };

        console.log('📤 [CLEAR POINTS] 发送清除所有标定点请求:', message);
        this.ws.send(JSON.stringify(message));

        // 更新本地标定点列表
        this.calibrationPoints = [];
        this.updateCalibrationPointsList();
        this.updateCalibrationStatus();

        // 更新最近操作信息
        if (this.lastOperation) {
            this.lastOperation.textContent = '清除了所有标定点';
        }
    }

    // 计算单应性矩阵
    computeHomographyMatrix() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.error('WebSocket not connected');
            return;
        }

        if (this.calibrationPoints.length < 4) {
            alert(window.i18n ? window.i18n.t('minimum_points_required') : '至少需要4个标定点才能计算单应性矩阵！');
            return;
        }

        const message = {
            action: 'compute_homography'
        };

        console.log('📤 [COMPUTE HOMOGRAPHY] 发送计算单应性矩阵请求:', message);
        this.ws.send(JSON.stringify(message));

        // 更新最近操作信息
        if (this.lastOperation) {
            this.lastOperation.textContent = window.i18n ? window.i18n.t('computing_homography_matrix') : '正在计算单应性矩阵...';
        }

        // 禁用按钮，防止重复点击
        if (this.computeHomographyBtn) {
            this.computeHomographyBtn.disabled = true;
            const span = this.computeHomographyBtn.querySelector('span');
            if (span) {
                span.textContent = window.i18n ? window.i18n.t('computing') : '计算中...';
            } else {
                this.computeHomographyBtn.textContent = window.i18n ? window.i18n.t('computing') : '计算中...';
            }
        }
    }

    // 保存单应性标定结果
    saveHomographyCalibration() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.error('WebSocket not connected');
            return;
        }

        const message = {
            action: 'save_homography'
        };

        console.log('📤 [SAVE HOMOGRAPHY] 发送保存单应性矩阵请求:', message);
        this.ws.send(JSON.stringify(message));

        // 更新最近操作信息
        if (this.lastOperation) {
            this.lastOperation.textContent = window.i18n ? window.i18n.t('saving_calibration_results') : '正在保存标定结果...';
        }
    }

    // 加载单应性标定结果
    loadHomographyCalibration() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.error('WebSocket not connected');
            return;
        }

        const message = {
            action: 'load_homography'
        };

        console.log('📤 [LOAD HOMOGRAPHY] 发送加载单应性矩阵请求:', message);
        this.ws.send(JSON.stringify(message));

        // 更新最近操作信息
        if (this.lastOperation) {
            this.lastOperation.textContent = window.i18n ? window.i18n.t('loading_calibration_results') : '正在加载标定结果...';
        }
    }

    // 更新标定点列表显示
    updateCalibrationPointsList() {
        const pointsList = document.getElementById('pointsList');
        if (!pointsList) return;

        if (this.calibrationPoints.length === 0) {
            const noPointsText = window.i18n ? window.i18n.t('no_calibration_points') : '暂无标定点';
            pointsList.innerHTML = `<p class="text-muted">${noPointsText}</p>`;
            return;
        }

        const imageText = window.i18n ? window.i18n.t('image_coord') : '图像';
        const groundText = window.i18n ? window.i18n.t('ground_coord') : '地面';
        
        let html = '';
        this.calibrationPoints.forEach((point, index) => {
            html += `
                <div class="point-item">
                    <span class="point-number">${index + 1}.</span>
                    <span class="image-coord">${imageText}: (${point.image.x.toFixed(1)}, ${point.image.y.toFixed(1)})</span>
                    <span class="ground-coord">${groundText}: (${point.ground.x}, ${point.ground.y})</span>
                </div>
            `;
        });

        pointsList.innerHTML = html;
    }

    // 更新标定状态
    updateCalibrationStatus() {
        const pointCount = this.calibrationPoints.length;
        const canCompute = pointCount >= 4;

        // 更新计算按钮状态
        if (this.computeHomographyBtn) {
            this.computeHomographyBtn.disabled = !canCompute || !this.calibrationMode;
            const span = this.computeHomographyBtn.querySelector('span');
            if (canCompute && this.calibrationMode) {
                const computeText = window.i18n ? window.i18n.t('compute_homography_matrix') : '计算单应性矩阵';
                if (span) {
                    span.textContent = computeText;
                } else {
                    this.computeHomographyBtn.textContent = computeText;
                }
            } else {
                const needPointsText = window.i18n ? window.i18n.t('need_points').replace('{count}', 4 - pointCount) : `需要${4 - pointCount}个点`;
                if (span) {
                    span.textContent = needPointsText;
                } else {
                    this.computeHomographyBtn.textContent = needPointsText;
                }
            }
        }

        // 更新其他按钮状态
        if (this.removeLastPointBtn) {
            this.removeLastPointBtn.disabled = pointCount === 0 || !this.calibrationMode;
        }

        if (this.clearPointsBtn) {
            this.clearPointsBtn.disabled = pointCount === 0 || !this.calibrationMode;
        }

        if (this.saveCalibrationBtn) {
            this.saveCalibrationBtn.disabled = !this.calibrated;
        }

        // 更新下载按钮状态
        if (this.downloadHomographyCalibrationBtn) {
            this.downloadHomographyCalibrationBtn.disabled = !this.calibrated;
        }

        console.log(`📊 [CALIBRATION STATUS] 标定点数量: ${pointCount}, 可计算: ${canCompute}, 已标定: ${this.calibrated}`);

        // 更新状态消息
        const statusMessage = this.calibrationMode ? 
            (window.i18n ? window.i18n.t('homography_calibration_mode_enabled') : '单应性矩阵标定模式已启用') : 
            (window.i18n ? window.i18n.t('homography_calibration_mode_disabled') : '单应性矩阵标定模式已禁用');
        this.updateStatus('success', statusMessage);

        if (this.lastOperation) {
            this.lastOperation.textContent = statusMessage;
        }

        // 显示使用提示
        if (this.calibrationMode) {
            const modeTitle = window.i18n ? window.i18n.t('homography_calibration_mode_title') : '单应性矩阵标定模式';
            const tipResolution = window.i18n ? window.i18n.t('calibration_tip_resolution') : '画面保持1920×1080分辨率确保计算精度';
            const tipClickPoints = window.i18n ? window.i18n.t('calibration_tip_click_points') : '点击视频中的地面格子交叉点进行标定';
            const tipFullscreen = window.i18n ? window.i18n.t('calibration_tip_fullscreen') : '按F11进入全屏模式，更精确选点';
            const tipInputCoords = window.i18n ? window.i18n.t('calibration_tip_input_coords') : '点击后输入该点的地面坐标（毫米）';
            const tipSelectPoints = window.i18n ? window.i18n.t('calibration_tip_select_points') : '建议选择画面四角和中心的交叉点';
            const tipShortcuts = window.i18n ? window.i18n.t('calibration_tip_shortcuts') : '快捷键：F11切换全屏 | ESC退出全屏';
            
            const tipMessage = `
                💡 <strong>${modeTitle}</strong><br/>
                📐 <strong>${tipResolution}</strong><br/>
                • ${tipClickPoints}<br/>
                • 🖥️ <strong>${tipFullscreen}</strong><br/>
                • ${tipInputCoords}<br/>
                • ${tipSelectPoints}<br/>
                • <strong>${tipShortcuts}</strong>
            `;
            this.showTemporaryMessage(tipMessage, 'info', 12000);
        }
    }

    // 处理标定模式状态变化
    handleCalibrationModeChanged(data) {
        console.log('🔄 [CALIBRATION MODE CHANGED] 收到模式切换响应:', data);
        
        this.calibrationMode = data.enabled;
        
        console.log(`🔄 [CALIBRATION MODE] 模式状态: ${this.calibrationMode ? '启用' : '禁用'}`);
        console.log(`🔄 [CALIBRATION MODE] this.calibrationMode = ${this.calibrationMode}`);

        // 更新按钮文本和样式
        if (this.toggleCalibrationBtn) {
            const span = this.toggleCalibrationBtn.querySelector('span');
            if (span) {
                span.textContent = this.calibrationMode ? window.i18n.t('exit_calibration_mode') : window.i18n.t('enter_calibration_mode');
            }
            this.toggleCalibrationBtn.className = this.calibrationMode ? 'btn btn-warning' : 'btn btn-primary';
            
            console.log('🔄 [CALIBRATION MODE] 按钮文本已更新:', span ? span.textContent : '无span元素');
        }

        // 显示/隐藏标定面板
        const calibrationPanel = document.getElementById('calibrationPanel');
        if (calibrationPanel) {
            calibrationPanel.style.display = this.calibrationMode ? 'block' : 'none';
        }

        // 在标定模式下隐藏浮动元素，保持画面洁净
        const videoOverlayControls = document.querySelector('.video-overlay-controls');
        
        if (this.calibrationMode) {
            // 进入标定模式：隐藏视频覆盖控件，保持画面完全洁净
            if (videoOverlayControls) {
                videoOverlayControls.style.display = 'none';
                console.log('🔄 [CALIBRATION MODE] 已隐藏视频覆盖控件');
            }
        } else {
            // 退出标定模式：恢复正常显示
            if (videoOverlayControls) {
                videoOverlayControls.style.display = 'flex';
                console.log('🔄 [CALIBRATION MODE] 已显示视频覆盖控件');
            }
        }

        // 隐藏其他面板
        if (this.calibrationMode) {
            const arucoPanel = document.getElementById('arucoPanel');
            const coordinateTestPanel = document.getElementById('coordinateTestPanel');
            if (arucoPanel) arucoPanel.style.display = 'none';
            if (coordinateTestPanel) coordinateTestPanel.style.display = 'none';
        }
    }

    // 处理单应性矩阵计算结果
    handleHomographyComputed(data) {
        // 恢复计算按钮状态
        if (this.computeHomographyBtn) {
            this.computeHomographyBtn.disabled = false;
            const span = this.computeHomographyBtn.querySelector('span');
            const computeText = window.i18n ? window.i18n.t('compute_homography_matrix') : '计算单应性矩阵';
            if (span) {
                span.textContent = computeText;
            } else {
                this.computeHomographyBtn.textContent = computeText;
            }
        }

        if (data.success) {
            this.calibrated = true;
            this.rawHomographyMatrix = data.homography_matrix;
            
            console.log('✅ [HOMOGRAPHY] 单应性矩阵计算成功');
            
            // 更新矩阵显示
            if (data.homography_matrix) {
                this.updateHomographyMatrix(data.homography_matrix);
            }

            // 更新状态
            this.updateCalibrationStatus();
            const successMessage = window.i18n ? window.i18n.t('homography_computation_success') : '单应性矩阵计算成功';
            this.updateStatus('success', successMessage);

            if (this.lastOperation) {
                this.lastOperation.textContent = successMessage;
            }

            const calibrationSuccessMsg = window.i18n ? window.i18n.t('calibration_success_message') : '标定成功！现在可以保存标定结果或进行坐标测试';
            this.showTemporaryMessage('✅ ' + calibrationSuccessMsg, 'success');
        } else {
            console.error('❌ [HOMOGRAPHY] 单应性矩阵计算失败:', data.error);
            const failedMessage = window.i18n ? window.i18n.t('homography_computation_failed') : '单应性矩阵计算失败';
            this.updateStatus('error', data.error || failedMessage);

            if (this.lastOperation) {
                this.lastOperation.textContent = failedMessage;
            }

            const calibrationFailedMsg = window.i18n ? window.i18n.t('calibration_failed_message') : '请检查标定点分布';
            this.showTemporaryMessage('❌ ' + (window.i18n ? window.i18n.t('calibration_failed_message') : '标定失败：') + (data.error || calibrationFailedMsg), 'error');
        }
    }

    handleArUcoParamsReset(data) {
        console.log('📤 [ARUCO PARAMS RESET] Received aruco params reset response:', data);
        // 处理 ArUco 参数重置响应的逻辑
        // 这里可以添加任何你想要在参数重置后执行的操作
    }

    // ========== ArUco 测试验证相关方法 ==========
    
    // 切换ArUco测试验证模式
    toggleArUcoTestingMode() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.error('WebSocket not connected');
            this.updateStatus('error', 'WebSocket未连接');
            return;
        }

        // 防抖逻辑：防止快速重复点击
        if (this.arucoToggleTimeout) {
            console.log('🎯 [ARUCO TESTING] 请求太频繁，忽略');
            return;
        }

        const message = {
            action: 'toggle_aruco_mode'
        };

        console.log('🎯 [ARUCO TESTING] 发送测试模式切换请求:', message);
        this.ws.send(JSON.stringify(message));

        this.updateStatus('info', window.i18n ? window.i18n.t('switching_aruco_testing_mode') : '正在切换ArUco测试模式...');
        
        // 设置500ms的防抖时间
        this.arucoToggleTimeout = setTimeout(() => {
            this.arucoToggleTimeout = null;
        }, 500);
    }
    
    // 显示ArUco测试指南
    showArUcoTestingGuide() {
        const guideContent = `
        <div class="aruco-testing-guide">
            <h4>🎯 ArUco 测试验证指南</h4>
            <div class="guide-section">
                <h5>📋 测试步骤</h5>
                <ol>
                    <li>${window.i18n ? window.i18n.t('ensure_homography_calibration_completed') : '确保已完成单应性矩阵标定或加载了矩阵文件'}</li>
                    <li>${window.i18n ? window.i18n.t('place_aruco_markers_known_positions') : '将ArUco标记放置在地面的已知位置'}</li>
                    <li>${window.i18n ? window.i18n.t('enable_aruco_test_mode') : '启用ArUco测试模式'}</li>
                    <li>${window.i18n ? window.i18n.t('observe_detection_results') : '观察检测结果和计算出的地面坐标'}</li>
                    <li>${window.i18n ? window.i18n.t('compare_calculated_coordinates') : '比较计算坐标与实际位置来验证精度'}</li>
                </ol>
            </div>
            <div class="guide-section">
                <h5>💡 测试提示</h5>
                <ul>
                    <li>标记应清晰可见，避免反光和阴影</li>
                    <li>可以调整检测参数以提高识别率</li>
                    <li>测试多个不同位置以验证整体精度</li>
                    <li>注意标记的方向，确保正确识别</li>
                </ul>
            </div>
        </div>
        `;
        
        this.showTemporaryMessage(guideContent, 'info', 10000);
    }

    // 更新ArUco测试结果显示
    updateArUcoTestingResults(data) {
        const markersDetectionList = document.getElementById('markersDetectionList');
        if (!markersDetectionList) return;
        
        if (!data.markers || data.markers.length === 0) {
            markersDetectionList.innerHTML = '<p class="no-markers">暂未检测到ArUco标记</p>';
            return;
        }
        
        let resultHTML = '';
        data.markers.forEach(marker => {
            const markerIdText = window.i18n ? window.i18n.t('marker_id') : '标记 ID';
            const coordinatesCalculatedText = window.i18n ? window.i18n.t('coordinates_calculated') : '已计算坐标';
            const noMatrixText = window.i18n ? window.i18n.t('no_matrix') : '无矩阵';
            const imageCenterText = window.i18n ? window.i18n.t('image_center') : '图像中心';
            const groundCoordinatesText = window.i18n ? window.i18n.t('ground_coordinates') : '地面坐标';
            const detectionQualityText = window.i18n ? window.i18n.t('detection_quality') : '检测质量';
            
            resultHTML += `
                <div class="marker-result-card">
                    <div class="marker-header">
                        <h5>🎯 ${markerIdText}: ${marker.id}</h5>
                        ${marker.ground_coordinate ? `<span class="coordinate-badge">${coordinatesCalculatedText}</span>` : `<span class="coordinate-badge no-matrix">${noMatrixText}</span>`}
                    </div>
                    <div class="marker-details">
                        <div class="detail-row">
                            <span class="detail-label">${imageCenterText}:</span>
                            <span class="detail-value">(${marker.center.x.toFixed(1)}, ${marker.center.y.toFixed(1)})</span>
                        </div>
                        ${marker.ground_coordinate ? `
                        <div class="detail-row">
                            <span class="detail-label">${groundCoordinatesText}:</span>
                            <span class="detail-value coordinate-value">(${marker.ground_coordinate.x.toFixed(1)}, ${marker.ground_coordinate.y.toFixed(1)}) mm</span>
                        </div>
                        ` : ''}
                        <div class="detail-row">
                            <span class="detail-label">${detectionQualityText}:</span>
                            <span class="detail-value">${this.getDetectionQuality(marker)}</span>
                        </div>
                    </div>
                </div>
            `;
        });
        
        markersDetectionList.innerHTML = resultHTML;
    }
    
    // 获取检测质量描述
    getDetectionQuality(marker) {
        // 这里可以根据marker的属性来判断检测质量
        // 目前简单返回"良好"
        return window.i18n ? window.i18n.t('quality_good') : '良好';
    }

    // 更新单应性矩阵显示
    updateHomographyMatrix(matrixData) {
        console.log('📊 [MATRIX UPDATE] 更新单应性矩阵显示:', matrixData);
        
        // 更新调试面板中的矩阵显示
        if (this.homographyMatrix) {
            if (Array.isArray(matrixData) && matrixData.length === 9) {
                // 格式化矩阵显示
                const matrixString = `
[${matrixData[0].toFixed(6)}, ${matrixData[1].toFixed(6)}, ${matrixData[2].toFixed(6)}]
[${matrixData[3].toFixed(6)}, ${matrixData[4].toFixed(6)}, ${matrixData[5].toFixed(6)}]
[${matrixData[6].toFixed(8)}, ${matrixData[7].toFixed(8)}, ${matrixData[8].toFixed(6)}]
                `.trim();
                this.homographyMatrix.textContent = matrixString;
            } else {
                this.homographyMatrix.textContent = JSON.stringify(matrixData, null, 2);
            }
        }
        
        // 在标定面板中也显示矩阵信息
        const calibrationPanel = document.getElementById('calibrationPanel');
        if (calibrationPanel) {
            let matrixDisplayDiv = calibrationPanel.querySelector('.matrix-display');
            if (!matrixDisplayDiv) {
                matrixDisplayDiv = document.createElement('div');
                matrixDisplayDiv.className = 'matrix-display';
                matrixDisplayDiv.innerHTML = `<h4>📊 ${window.i18n ? window.i18n.t('calculation_results') : '计算结果'}</h4>`;
                calibrationPanel.appendChild(matrixDisplayDiv);
            }
            
            if (Array.isArray(matrixData) && matrixData.length === 9) {
                const successTitle = window.i18n ? window.i18n.t('homography_matrix_success') : '单应性矩阵计算成功';
                const copyButtonText = window.i18n ? window.i18n.t('copy_matrix_data') : '复制矩阵数据';
                const matrixSavedText = window.i18n ? window.i18n.t('matrix_saved_aruco_test') : '矩阵已保存，现在可以进行ArUco测试验证';
                const calculationResultsTitle = window.i18n ? window.i18n.t('calculation_results') : '计算结果';
                
                const matrixInfo = `
                    <div class="matrix-result">
                        <h5>✅ ${successTitle}</h5>
                        <div class="matrix-values">
                            <pre>[${matrixData[0].toFixed(6)}, ${matrixData[1].toFixed(6)}, ${matrixData[2].toFixed(6)}]
[${matrixData[3].toFixed(6)}, ${matrixData[4].toFixed(6)}, ${matrixData[5].toFixed(6)}]
[${matrixData[6].toFixed(8)}, ${matrixData[7].toFixed(8)}, ${matrixData[8].toFixed(6)}]</pre>
                        </div>
                        <div class="matrix-actions">
                            <button class="btn btn-secondary btn-sm" onclick="navigator.clipboard.writeText('${JSON.stringify(matrixData)}')">${copyButtonText}</button>
                            <small class="text-muted">${matrixSavedText}</small>
                        </div>
                    </div>
                `;
                matrixDisplayDiv.innerHTML = `<h4>📊 ${calculationResultsTitle}</h4>` + matrixInfo;
            }
        }
        
        // 显示成功提示
        const successTitle = window.i18n ? window.i18n.t('homography_calculation_success_title') : '单应性矩阵计算成功！';
        const matrixDisplayedText = window.i18n ? window.i18n.t('matrix_displayed_in_panel') : '矩阵数据已显示在标定面板中';
        const canSaveText = window.i18n ? window.i18n.t('can_save_calibration_results') : '现在可以保存标定结果';
        const switchToArucoText = window.i18n ? window.i18n.t('switch_to_aruco_test') : '或切换到ArUco测试模式验证精度';
        
        this.showTemporaryMessage(`
            <div class="matrix-success-tip">
                <h5>🎉 ${successTitle}</h5>
                <ul>
                    <li>✅ ${matrixDisplayedText}</li>
                    <li>💾 ${canSaveText}</li>
                    <li>🎯 ${switchToArucoText}</li>
                </ul>
            </div>
        `, 'success', 6000);
    }

    // ========== 错误处理相关方法 ==========
    
    // 错误通知处理方法
    handleErrorNotification(data) {
        const { error_type, title, message, timestamp } = data;
        
        console.error(`🚨 [ERROR NOTIFICATION] ${error_type}: ${title} - ${message}`);
        
        // 翻译title和message（如果它们是翻译键）
        const translatedTitle = window.i18n ? window.i18n.t(title) : title;
        const translatedMessage = window.i18n ? window.i18n.t(message) : message;
        
        // 根据错误类型显示不同级别的通知
        let statusType = 'error';
        let displayMessage = `${translatedTitle}: ${translatedMessage}`;
        
        switch (error_type) {
            case 'camera_warning':
                statusType = 'warning';
                this.showErrorToast(translatedTitle, translatedMessage, 'warning', 5000);
                break;
            case 'camera_critical':
                statusType = 'error';
                this.showErrorToast(translatedTitle, translatedMessage, 'error', 10000);
                this.showCameraErrorModal(translatedTitle, translatedMessage);
                break;
            case 'camera_recovery':
                statusType = 'info';
                this.showErrorToast(translatedTitle, translatedMessage, 'success', 3000);
                break;
            case 'camera_recovery_success':
                statusType = 'success';
                this.showErrorToast(translatedTitle, translatedMessage, 'success', 5000);
                break;
            case 'camera_recovery_failed':
                statusType = 'error';
                this.showErrorToast(translatedTitle, translatedMessage, 'error', 10000);
                break;
            default:
                this.showErrorToast(translatedTitle, translatedMessage, 'info', 5000);
        }
        
        // 更新状态显示
        this.updateStatus(statusType, displayMessage);
        this.updateLastOperation(`${error_type}: ${translatedMessage}`);
    }

    // 显示错误提示框
    showErrorToast(title, message, type = 'error', duration = 5000) {
        // 创建提示框元素
        const toast = document.createElement('div');
        toast.className = `error-toast error-toast-${type}`;
        toast.innerHTML = `
            <div class="error-toast-header">
                <span class="error-toast-icon">${this.getErrorIcon(type)}</span>
                <span class="error-toast-title">${title}</span>
                <button class="error-toast-close" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
            <div class="error-toast-message">${message}</div>
        `;
        
        // 添加到页面
        let toastContainer = document.getElementById('errorToastContainer');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'errorToastContainer';
            toastContainer.className = 'error-toast-container';
            document.body.appendChild(toastContainer);
        }
        
        toastContainer.appendChild(toast);
        
        // 自动移除
        setTimeout(() => {
            if (toast.parentNode) {
                toast.remove();
            }
        }, duration);
        
        // 添加动画效果
        setTimeout(() => toast.classList.add('show'), 100);
    }

    // 显示严重错误模态框
    showCameraErrorModal(title, message) {
        const modal = document.createElement('div');
        modal.className = 'camera-error-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <span class="modal-icon">⚠️</span>
                    <h3>${title}</h3>
                    <button class="modal-close" onclick="this.closest('.camera-error-modal').remove()">×</button>
                </div>
                <div class="modal-body">
                    <p>${message}</p>
                    <div class="error-suggestions">
                        <h4>${window.i18n ? window.i18n.t('suggested_solutions') : '建议解决方案：'}</h4>
                        <ul>
                            <li>${window.i18n ? window.i18n.t('check_camera_usage') : '检查摄像头是否被其他程序占用'}</li>
                            <li>${window.i18n ? window.i18n.t('try_reconnect_camera') : '尝试重新连接摄像头设备'}</li>
                            <li>${window.i18n ? window.i18n.t('restart_videomapping') : '重启VideoMapping程序'}</li>
                            <li>${window.i18n ? window.i18n.t('check_device_permissions') : '检查设备权限设置'}</li>
                        </ul>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-primary" onclick="this.closest('.camera-error-modal').remove()">${window.i18n ? window.i18n.t('confirm') : '确定'}</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }

    // 获取错误图标
    getErrorIcon(type) {
        const icons = {
            'error': '❌',
            'warning': '⚠️',
            'success': '✅',
            'info': 'ℹ️'
        };
        return icons[type] || 'ℹ️';
    }

    // 标定专用全屏切换（视频全屏，用于精确点击）
    toggleCalibrationFullscreen() {
        if (!document.fullscreenElement) {
            // 进入视频全屏
            const videoElement = this.videoElement || document.getElementById('videoImage');
            if (videoElement && videoElement.requestFullscreen) {
                videoElement.requestFullscreen().then(() => {
                    this.updateCalibrationFullscreenButton(true);
                    this.showFullscreenCalibrationTip();
                }).catch(err => {
                    console.error('视频全屏请求失败:', err);
                    const failedTitle = window.i18n ? window.i18n.t('fullscreen_failed') : '全屏失败';
                    const permissionError = window.i18n ? window.i18n.t('fullscreen_permission_error') : '无法进入视频全屏模式，请检查浏览器权限';
                    this.showErrorToast(failedTitle, permissionError, 'error', 3000);
                });
            } else if (videoElement && videoElement.mozRequestFullScreen) {
                videoElement.mozRequestFullScreen();
                this.updateCalibrationFullscreenButton(true);
                this.showFullscreenCalibrationTip();
            } else if (videoElement && videoElement.webkitRequestFullscreen) {
                videoElement.webkitRequestFullscreen();
                this.updateCalibrationFullscreenButton(true);
                this.showFullscreenCalibrationTip();
            } else if (videoElement && videoElement.msRequestFullscreen) {
                videoElement.msRequestFullscreen();
                this.updateCalibrationFullscreenButton(true);
                this.showFullscreenCalibrationTip();
            } else {
                this.showErrorToast('不支持全屏', '当前浏览器不支持视频全屏功能', 'warning', 3000);
            }
        } else {
            // 退出全屏
            if (document.exitFullscreen) {
                document.exitFullscreen().then(() => {
                    this.updateCalibrationFullscreenButton(false);
                }).catch(err => {
                    console.error('退出全屏失败:', err);
                });
            } else if (document.mozCancelFullScreen) {
                document.mozCancelFullScreen();
                this.updateCalibrationFullscreenButton(false);
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
                this.updateCalibrationFullscreenButton(false);
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
                this.updateCalibrationFullscreenButton(false);
            }
        }
    }

    // 更新标定全屏按钮状态
    updateCalibrationFullscreenButton(isFullscreen) {
        if (!this.calibrationFullscreenBtn) return;

        if (isFullscreen) {
            this.calibrationFullscreenBtn.classList.add('fullscreen-active');
            this.calibrationFullscreenBtn.querySelector('.fullscreen-icon').textContent = '❏';
            this.calibrationFullscreenBtn.querySelector('.fullscreen-text').textContent = '退出';
            this.calibrationFullscreenBtn.title = '退出全屏模式 (ESC)';
        } else {
            this.calibrationFullscreenBtn.classList.remove('fullscreen-active');
            this.calibrationFullscreenBtn.querySelector('.fullscreen-icon').textContent = '⛶';
            this.calibrationFullscreenBtn.querySelector('.fullscreen-text').textContent = '全屏';
            this.calibrationFullscreenBtn.title = '全屏模式 - 提高点击选择精度';
        }
    }

    // 监听全屏状态变化（处理ESC键等方式退出全屏）
    setupFullscreenListener() {
        const fullscreenChangeHandler = () => {
            const isFullscreen = !!document.fullscreenElement;
            this.updateCalibrationFullscreenButton(isFullscreen);
            
            if (!isFullscreen) {
                // 退出全屏时的处理
                console.log('📱 [FULLSCREEN] 已退出全屏模式');
            }
        };

        document.addEventListener('fullscreenchange', fullscreenChangeHandler);
        document.addEventListener('webkitfullscreenchange', fullscreenChangeHandler);
        document.addEventListener('mozfullscreenchange', fullscreenChangeHandler);
        document.addEventListener('MSFullscreenChange', fullscreenChangeHandler);
    }

    // 下载相机内参标定文件
    downloadCameraCalibration() {
        // 请求后端提供相机内参标定文件
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                action: 'download_camera_calibration'
            }));
            this.showTemporaryMessage('正在准备相机内参标定文件...', 'info');
            console.log('📥 [DOWNLOAD] 请求下载相机内参标定文件');
        } else {
            this.showTemporaryMessage('WebSocket连接未建立，无法下载文件', 'error');
        }
    }

    // 下载单应性矩阵标定文件
    downloadHomographyCalibration() {
        // 检查是否有矩阵数据
        if (!this.rawHomographyMatrix) {
            this.showTemporaryMessage('单应性矩阵数据不可用，请先进行标定。', 'warning');
            return;
        }

        // Create export data
        const exportData = {
            timestamp: new Date().toISOString(),
            description: '单应性矩阵标定文件（从图像到地面坐标的转换）',
            file_type: 'homography_calibration',
            homography_matrix: this.rawHomographyMatrix,
            calibration_points: this.calibrationPoints || [],
            point_count: this.calibrationPoints ? this.calibrationPoints.length : 0,
            version: '1.0'
        };

        // Convert to JSON format
        const jsonData = JSON.stringify(exportData, null, 2);

        // Create blob and download
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `homography_calibration_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;

        // Trigger download
        document.body.appendChild(a);
        a.click();

        // Cleanup
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 0);

        this.showTemporaryMessage(window.i18n ? window.i18n.t('homography_calibration_downloaded') : '已下载单应性矩阵标定文件', 'success');
        console.log('📥 [DOWNLOAD] Homography calibration file downloaded');
    }

    // 处理相机内参标定文件下载响应
    handleCameraCalibrationDownload(data) {
        if (data.success && data.file_content) {
            // 创建下载链接
            const blob = new Blob([data.file_content], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = data.filename || `camera_calibration_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;

            // 触发下载
            document.body.appendChild(a);
            a.click();

            // 清理
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 0);

            this.showTemporaryMessage(window.i18n ? window.i18n.t('camera_calibration_downloaded') : '已下载相机内参标定文件', 'success');
            console.log('📥 [DOWNLOAD] Camera calibration file downloaded:', data.filename);
        } else {
            this.showTemporaryMessage(data.error || (window.i18n ? window.i18n.t('camera_calibration_download_failed') : '下载相机内参标定文件失败'), 'error');
            console.error('❌ [DOWNLOAD] Camera calibration download failed:', data.error);
        }
    }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    // 初始化国际化
    if (window.i18n) {
        window.i18n.init();
    }
    
    // 初始化视频流
    window.videoStream = new VideoStream();
});
