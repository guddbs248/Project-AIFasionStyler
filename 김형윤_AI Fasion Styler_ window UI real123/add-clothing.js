// 현재 선택된 이미지 (base64)
let currentImage = null;
// 추출된 색상 정보
let extractedColors = null;
// 사용자가 선택한 색상만 저장
let selectedColors = [];

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

// 앱 초기화
function initializeApp() {
    // 이미지 업로드 이벤트
    setupImageUpload();
    
    // 옷 추가 버튼 이벤트
    document.getElementById('add-clothing').addEventListener('click', addClothing);
    
    // 엔터 키로 옷 추가
    document.getElementById('clothing-name').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') addClothing();
    });
    document.getElementById('clothing-tags').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') addClothing();
    });
}

// 이미지 업로드 설정
function setupImageUpload() {
    const imageInput = document.getElementById('clothing-image');
    const uploadArea = document.getElementById('image-upload-area');
    const imagePreview = document.getElementById('image-preview');
    const uploadPlaceholder = document.getElementById('upload-placeholder');
    const removeImageBtn = document.getElementById('remove-image-btn');
    
    // 업로드 영역 클릭 시 파일 선택
    uploadArea.querySelector('.image-preview-container').addEventListener('click', function(e) {
        if (e.target !== imageInput) {
            imageInput.click();
        }
    });
    
    // 파일 선택 시
    imageInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            // 이미지 압축 및 처리
            compressImage(file).then(compressedImage => {
                currentImage = compressedImage;
                imagePreview.src = currentImage;
                imagePreview.style.display = 'block';
                uploadPlaceholder.style.display = 'none';
                removeImageBtn.style.display = 'block';
                
                // 이미지에서 색상 자동 추출
                extractColorsFromImage(currentImage).then(colors => {
                    extractedColors = colors;
                    displayExtractedColors(colors);
                }).catch(err => {
                    console.error('색상 추출 실패:', err);
                });
            }).catch(err => {
                console.error('이미지 처리 실패:', err);
                alert('이미지 처리 중 오류가 발생했습니다.');
            });
        }
    });
    
    // 이미지 제거 버튼
    removeImageBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        currentImage = null;
        extractedColors = null;
        selectedColors = [];
        imagePreview.src = '';
        imagePreview.style.display = 'none';
        uploadPlaceholder.style.display = 'flex';
        removeImageBtn.style.display = 'none';
        imageInput.value = '';
        
        // 색상 표시 제거
        const colorDisplay = document.getElementById('extracted-colors-display');
        if (colorDisplay) {
            colorDisplay.style.display = 'none';
        }
    });
}

// 이미지 압축 함수 (localStorage 용량 절약)
async function compressImage(file, maxWidth = 800, maxHeight = 800, quality = 0.7) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = function(event) {
            const img = new Image();
            
            img.onload = function() {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                // 이미지 크기 계산 (비율 유지)
                let width = img.width;
                let height = img.height;
                
                if (width > maxWidth || height > maxHeight) {
                    if (width > height) {
                        if (width > maxWidth) {
                            height = (height * maxWidth) / width;
                            width = maxWidth;
                        }
                    } else {
                        if (height > maxHeight) {
                            width = (width * maxHeight) / height;
                            height = maxHeight;
                        }
                    }
                }
                
                canvas.width = width;
                canvas.height = height;
                
                // 이미지 그리기
                ctx.drawImage(img, 0, 0, width, height);
                
                // JPEG로 압축 (용량 절약)
                const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
                
                // 압축 후 크기 확인 (약 500KB 이하로 제한)
                if (compressedDataUrl.length > 500000) {
                    // 더 낮은 품질로 재압축
                    const lowerQuality = quality * 0.6;
                    const retryDataUrl = canvas.toDataURL('image/jpeg', lowerQuality);
                    resolve(retryDataUrl);
                } else {
                    resolve(compressedDataUrl);
                }
            };
            
            img.onerror = function() {
                reject(new Error('이미지 로드 실패'));
            };
            
            img.src = event.target.result;
        };
        
        reader.onerror = function() {
            reject(new Error('파일 읽기 실패'));
        };
        
        reader.readAsDataURL(file);
    });
}

// 이미지에서 주요 색상 추출 (AI 기반)
async function extractColorsFromImage(imageSrc) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        img.onload = function() {
            try {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                // 이미지 크기 조정 (성능 향상)
                const maxSize = 200;
                let width = img.width;
                let height = img.height;
                
                if (width > height) {
                    if (width > maxSize) {
                        height = (height * maxSize) / width;
                        width = maxSize;
                    }
                } else {
                    if (height > maxSize) {
                        width = (width * maxSize) / height;
                        height = maxSize;
                    }
                }
                
                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);
                
                // 픽셀 데이터 추출
                const imageData = ctx.getImageData(0, 0, width, height);
                const pixels = imageData.data;
                
                // 색상 추출 알고리즘 (K-means 유사 알고리즘)
                const colors = extractDominantColors(pixels, width * height);
                
                resolve(colors);
            } catch (error) {
                reject(error);
            }
        };
        
        img.onerror = function() {
            reject(new Error('이미지 로드 실패'));
        };
        
        img.src = imageSrc;
    });
}

// 주요 색상 추출 (간단한 K-means 기반)
function extractDominantColors(pixels, pixelCount) {
    // 색상 빈도 수집 (간소화된 방법)
    const colorMap = new Map();
    
    // 색상 공간을 그룹화하여 수집 (빠른 근사치)
    for (let i = 0; i < pixels.length; i += 16) { // 샘플링 (성능 향상)
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        const a = pixels[i + 3];
        
        // 투명도가 낮은 픽셀은 제외
        if (a < 128) continue;
        
        // 색상 양자화 (비슷한 색상을 그룹화)
        const quantizedR = Math.floor(r / 32) * 32;
        const quantizedG = Math.floor(g / 32) * 32;
        const quantizedB = Math.floor(b / 32) * 32;
        
        const colorKey = `${quantizedR},${quantizedG},${quantizedB}`;
        colorMap.set(colorKey, (colorMap.get(colorKey) || 0) + 1);
    }
    
    // 빈도순으로 정렬하고 상위 색상 추출
    const sortedColors = Array.from(colorMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5) // 상위 5개 색상
        .map(([colorKey, count]) => {
            const [r, g, b] = colorKey.split(',').map(Number);
            return {
                rgb: { r, g, b },
                hex: rgbToHex(r, g, b),
                name: getColorName(r, g, b),
                percentage: (count / (pixelCount / 16)) * 100
            };
        });
    
    return sortedColors;
}

// RGB를 HEX로 변환
function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(x => {
        const hex = x.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    }).join('');
}

// 색상 이름 추정
function getColorName(r, g, b) {
    const colors = [
        { name: '빨강', r: 255, g: 0, b: 0 },
        { name: '주황', r: 255, g: 165, b: 0 },
        { name: '노랑', r: 255, g: 255, b: 0 },
        { name: '초록', r: 0, g: 255, b: 0 },
        { name: '파랑', r: 0, g: 0, b: 255 },
        { name: '남색', r: 75, g: 0, b: 130 },
        { name: '보라', r: 128, g: 0, b: 128 },
        { name: '핑크', r: 255, g: 192, b: 203 },
        { name: '갈색', r: 165, g: 42, b: 42 },
        { name: '검정', r: 0, g: 0, b: 0 },
        { name: '회색', r: 128, g: 128, b: 128 },
        { name: '흰색', r: 255, g: 255, b: 255 },
        { name: '베이지', r: 245, g: 245, b: 220 },
        { name: '네이비', r: 0, g: 0, b: 128 },
        { name: '카키', r: 189, g: 183, b: 107 }
    ];
    
    // 가장 가까운 색상 찾기
    let minDistance = Infinity;
    let closestColor = '기타';
    
    for (const color of colors) {
        const distance = Math.sqrt(
            Math.pow(r - color.r, 2) +
            Math.pow(g - color.g, 2) +
            Math.pow(b - color.b, 2)
        );
        
        if (distance < minDistance) {
            minDistance = distance;
            closestColor = color.name;
        }
    }
    
    // 회색 계열 처리
    const grayThreshold = 30;
    if (Math.abs(r - g) < grayThreshold && Math.abs(g - b) < grayThreshold && Math.abs(r - b) < grayThreshold) {
        if (r < 50) return '검정';
        if (r > 200) return '흰색';
        return '회색';
    }
    
    return closestColor;
}

// 추출된 색상 표시 (클릭 가능하도록)
function displayExtractedColors(colors) {
    let colorDisplay = document.getElementById('extracted-colors-display');
    if (!colorDisplay) {
        colorDisplay = document.createElement('div');
        colorDisplay.id = 'extracted-colors-display';
        colorDisplay.className = 'extracted-colors-display';
        
        const imageUploadArea = document.getElementById('image-upload-area');
        imageUploadArea.appendChild(colorDisplay);
    }
    
    if (colors && colors.length > 0) {
        // 초기화: 처음에는 선택된 색상이 없음
        selectedColors = [];
        
        colorDisplay.innerHTML = `
            <div class="color-info">
                <span class="color-label">🎨 AI가 감지한 주요 색상 (클릭하여 선택):</span>
                <small style="display: block; color: #666; margin-top: 5px;">배경색을 제외하고 옷 색상만 선택해주세요</small>
                <div class="color-palette">
                    ${colors.slice(0, 5).map((color, index) => {
                        const isSelected = selectedColors.includes(index);
                        return `
                            <div class="color-item ${isSelected ? 'selected' : ''}" data-color-index="${index}">
                                <div class="color-swatch" 
                                     style="background-color: ${color.hex}; ${isSelected ? 'border: 3px solid #667eea; box-shadow: 0 0 10px rgba(102, 126, 234, 0.5);' : ''}" 
                                     title="${color.name} (${color.percentage.toFixed(1)}%)"></div>
                                <span class="color-name">${color.name}</span>
                                ${isSelected ? '<span class="check-mark">✓</span>' : ''}
                            </div>
                        `;
                    }).join('')}
                </div>
                <div class="selected-colors-info" id="selected-colors-info" style="margin-top: 10px; font-size: 0.85rem; color: #667eea; display: none;">
                    선택된 색상이 반영됩니다
                </div>
            </div>
        `;
        colorDisplay.style.display = 'block';
        
        // 색상 클릭 이벤트 리스너 추가
        colorDisplay.querySelectorAll('.color-item').forEach(item => {
            item.addEventListener('click', function() {
                const colorIndex = parseInt(this.getAttribute('data-color-index'));
                toggleColorSelection(colorIndex, colors, colorDisplay);
            });
        });
    } else {
        colorDisplay.style.display = 'none';
    }
}

// 색상 선택 토글
function toggleColorSelection(colorIndex, allColors, colorDisplay) {
    const index = selectedColors.indexOf(colorIndex);
    
    if (index > -1) {
        // 이미 선택된 색상이면 선택 해제
        selectedColors.splice(index, 1);
    } else {
        // 선택되지 않은 색상이면 선택
        selectedColors.push(colorIndex);
    }
    
    // UI 업데이트
    const colorItems = colorDisplay.querySelectorAll('.color-item');
    const selectedInfo = document.getElementById('selected-colors-info');
    
    colorItems.forEach((item, idx) => {
        const isSelected = selectedColors.includes(idx);
        const swatch = item.querySelector('.color-swatch');
        const checkMark = item.querySelector('.check-mark');
        
        if (isSelected) {
            item.classList.add('selected');
            swatch.style.border = '3px solid #667eea';
            swatch.style.boxShadow = '0 0 10px rgba(102, 126, 234, 0.5)';
            if (!checkMark) {
                const mark = document.createElement('span');
                mark.className = 'check-mark';
                mark.textContent = '✓';
                item.appendChild(mark);
            }
        } else {
            item.classList.remove('selected');
            swatch.style.border = '';
            swatch.style.boxShadow = '';
            if (checkMark) {
                checkMark.remove();
            }
        }
    });
    
    // 선택된 색상 정보 표시
    if (selectedColors.length > 0) {
        if (selectedInfo) {
            selectedInfo.style.display = 'block';
            selectedInfo.textContent = `${selectedColors.length}개 색상이 선택되었습니다`;
        }
    } else {
        if (selectedInfo) {
            selectedInfo.style.display = 'none';
        }
    }
    
    // 추출된 색상 업데이트 (선택된 색상만)
    extractedColors = selectedColors.map(idx => allColors[idx]);
}

// localStorage에서 옷장 데이터 가져오기
function getWardrobeFromStorage() {
    const stored = localStorage.getItem('wardrobe');
    return stored ? JSON.parse(stored) : [];
}

// localStorage에 옷장 데이터 저장
function saveWardrobeToStorage(wardrobe) {
    try {
        const dataString = JSON.stringify(wardrobe);
        const dataSize = new Blob([dataString]).size;
        
        // 데이터 크기 확인 (5MB 제한 - localStorage는 보통 5-10MB)
        if (dataSize > 4 * 1024 * 1024) { // 4MB 경고
            const shouldContinue = confirm(
                `데이터 크기가 ${(dataSize / 1024 / 1024).toFixed(2)}MB입니다.\n` +
                `localStorage 용량을 절약하기 위해 오래된 이미지를 제거하는 것을 권장합니다.\n\n` +
                `계속하시겠습니까?`
            );
            if (!shouldContinue) {
                throw new Error('사용자가 취소했습니다.');
            }
        }
        
        localStorage.setItem('wardrobe', dataString);
        return null; // 정상 저장 (null 반환으로 구분)
    } catch (error) {
        if (error.name === 'QuotaExceededError' || error.message.includes('quota') || error.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
            // localStorage 용량 초과 시 해결 방법 제시
            const shouldCleanOld = confirm(
                '저장 공간이 부족합니다.\n\n' +
                '해결 방법:\n' +
                '1. 오래된 옷의 이미지를 제거하거나\n' +
                '2. 브라우저 캐시를 지우거나\n' +
                '3. 이미지 없는 옷을 등록하세요.\n\n' +
                '오래된 옷의 이미지를 제거하시겠습니까?'
            );
            
            if (shouldCleanOld) {
                // 이미지가 있는 옷 중에서 오래된 것부터 이미지 제거
                const sortedWardrobe = wardrobe.sort((a, b) => (a.id || 0) - (b.id || 0));
                let cleanedCount = 0;
                
                for (let i = 0; i < sortedWardrobe.length && cleanedCount < 10; i++) {
                    if (sortedWardrobe[i].image) {
                        sortedWardrobe[i].image = null;
                        cleanedCount++;
                    }
                }
                
                try {
                    localStorage.setItem('wardrobe', JSON.stringify(sortedWardrobe));
                    alert(`${cleanedCount}개의 오래된 옷 이미지를 제거했습니다. 다시 시도해주세요.`);
                    return sortedWardrobe;
                } catch (retryError) {
                    alert('여전히 공간이 부족합니다. 브라우저 캐시를 지우거나 이미지 없이 등록해주세요.');
                    throw retryError;
                }
            } else {
                alert('저장이 취소되었습니다. 이미지를 제거하고 다시 시도해주세요.');
                throw error;
            }
        } else {
            throw error;
        }
    }
    return wardrobe;
}

// 옷 추가 함수
function addClothing() {
    const name = document.getElementById('clothing-name').value.trim();
    const category = document.getElementById('clothing-category').value;
    const season = document.getElementById('clothing-season').value;
    const tagsInput = document.getElementById('clothing-tags').value.trim();
    
    if (!name || !category || !season || !tagsInput) {
        alert('모든 필수 항목(옷 이름, 카테고리, 계절, 태그)을 입력해주세요.');
        return;
    }
    
    const tags = tagsInput.split(',').map(tag => tag.trim()).filter(tag => tag);
    
    // 선택된 색상만 저장 (선택한 색상이 없으면 추출된 색상 모두 저장)
    const colorsToSave = selectedColors.length > 0 ? extractedColors : (extractedColors || null);
    
    const clothing = {
        name: name,
        category: category,
        season: season,
        tags: tags,
        image: currentImage,
        colors: colorsToSave, // 사용자가 선택한 색상 또는 AI가 추출한 색상 정보
        status: 'ready', // ready: 사용 가능, washing: 빨래 중, clean: 깨끗함 (사용 가능)
        id: Date.now() + Math.random() // 고유 ID
    };
    
    // localStorage에서 기존 옷장 가져오기
    const wardrobe = getWardrobeFromStorage();
    wardrobe.push(clothing);
    
    // localStorage에 저장
    try {
        const result = saveWardrobeToStorage(wardrobe);
        
        // 성공 메시지 및 폼 초기화
        if (result && result !== wardrobe) {
            // 이미지가 제거된 경우 (새로운 배열 반환)
            alert('옷이 등록되었습니다. (저장 공간 절약을 위해 일부 오래된 이미지가 제거되었습니다.)');
        } else {
            alert('옷이 성공적으로 등록되었습니다!');
        }
        resetClothingForm();
    } catch (error) {
        console.error('저장 실패:', error);
        // 에러 메시지는 saveWardrobeToStorage에서 이미 표시됨
    }
}

// 옷 등록 폼 초기화
function resetClothingForm() {
    document.getElementById('clothing-name').value = '';
    document.getElementById('clothing-category').value = '';
    document.getElementById('clothing-season').value = '';
    document.getElementById('clothing-tags').value = '';
    currentImage = null;
    extractedColors = null;
    selectedColors = [];
    
    const imagePreview = document.getElementById('image-preview');
    const uploadPlaceholder = document.getElementById('upload-placeholder');
    const removeImageBtn = document.getElementById('remove-image-btn');
    const imageInput = document.getElementById('clothing-image');
    const colorDisplay = document.getElementById('extracted-colors-display');
    
    imagePreview.src = '';
    imagePreview.style.display = 'none';
    uploadPlaceholder.style.display = 'flex';
    removeImageBtn.style.display = 'none';
    imageInput.value = '';
    
    if (colorDisplay) {
        colorDisplay.style.display = 'none';
    }
}

