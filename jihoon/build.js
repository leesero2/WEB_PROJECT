var marker_danger = [];
var marker_soso = [];
var marker_safe = [];

var dataBuildings = [];
var dataFireStations = [];

var fs_image_src = '../firestation.png';
var fs_image_size = new kakao.maps.Size(20, 20);
var fs_image_op = { offset: new kakao.maps.Point(10, 10) };

var fs_image = new kakao.maps.MarkerImage(fs_image_src, fs_image_size, fs_image_op);




function showLoadingOverlay() {
    var loadingOverlay = document.getElementById('loadingOverlay');
    loadingOverlay.style.display = 'flex';
}

// 로딩 창 숨김 함수
function hideLoadingOverlay() {
    var loadingOverlay = document.getElementById('loadingOverlay');
    loadingOverlay.style.display = 'none';
}



fetch('../csv파일/new_fs119.csv')
    .then(response => response.text())
    .then(csvData => {
        var fs119 = csvData.split('\n');
        for (var i = 0; i < fs119.length; i++) {
            var row119 = fs119[i].split(',');
            var marker = new kakao.maps.Marker({
                position: new kakao.maps.LatLng(row119[4], row119[3]),
                map: map,
                image: fs_image
            });
        }
    });



// 소방서 데이터를 로드하는 함수
function loadFireStationData() {
    return new Promise(function (resolve, reject) {
        $.ajax({
            url: '../csv파일/new_fs119.csv',
            dataType: 'text',
            success: function (data) {
                $.csv.toObjects(data, {}, function (err, data) {
                    if (err) {
                        reject(err);
                    } else {
                        dataFireStations = data;
                        resolve();
                    }
                });
            },
            error: reject
        });
    });
}


// 건물의 화재위험지수를 계산하는 함수
function calculateBuildingScore(building) {
    var buildingScore = 0;
    var buildingAge = new Date().getFullYear() - parseInt(building["사용승인일"].substring(0, 4));

    // 가중치 정의
    var ageWeight = 0.4;
    var usageWeight = 0.3;
    var structureWeight = 0.15;
    var distanceWeight = 0.15;

    // 노후별 점수
    var ageScore = 0;
    if (buildingAge < 10) ageScore = 0;
    else if (buildingAge < 20) ageScore = 1;
    else if (buildingAge < 30) ageScore = 3;
    else if (buildingAge < 40) ageScore = 7;
    else if (buildingAge < 50) ageScore = 9;
    else ageScore = 10;
    buildingScore += ageWeight * ageScore;

    // 주용도별 점수
    var usageScore = 0;
    switch (building["주용도코드명"]) {
        case '공동주택':
        case '숙박시설':
            usageScore += 3;
            break;
        case '공장':
        case '발전시설':
            usageScore += 7;
            break;
        case '교육연구및복지시설':
        case '교육연구시설':
        case '자원순환관련시설':
            usageScore += 6;
            break;
        case '교정및군사시설':
            usageScore += 8;
            break;
        case '단독주택':
        case '업무시설':
        case '제1종근린생활시설':
        case '의료시설':
        case '노유자시설':
        case '판매시설':
        case '판매및영업시설':
        case '문화및집회시설':
        case '종교시설':
        case '운동시설':
        case '공공용시설':
        case '동.식물관련시설':
            usageScore += 4;
            break;
        case '방송통신시설':
        case '창고시설':
        case '운수시설':
        case '자동차관련시설':
            usageScore += 5;
            break;
        case '분뇨.쓰레기처리시설':
            usageScore += 9;
            break;
        case '위험물저장및처리시설':
            usageScore += 10;
            break;
        default:
            // 기타 (제조업소, 묘지, 수련, 관광휴게시설, 근린생활시설) - 점수 없음
            break;
    }
    buildingScore += usageWeight * usageScore;

    // 건물 구조별 점수
    var structureScore = 0;
    switch (building["구조코드명"]) {
        case '철근콘크리트구조':
        case '프리케스트콘크리트구조':
        case '철골철근콘크리트구조':
            structureScore += 2;
            break;
        case '강파이프구조':
        case '기타콘크리트구조':
        case '철골콘크리트구조':
            structureScore += 3;
            break;
        case '경량철골구조':
        case '기타강구조':
        case '일반철골구조':
        case '단일형강구조':
        case '스틸하우스조':
            structureScore += 4;
            break;
        case '컨테이너조':
            structureScore += 5;
            break;
        case '공업화박판강구조(PEB)':
            structureScore += 6;
            break;
        case '벽돌구조':
        case '블록구조':
        case '시멘트블럭조':
        case '조적구조':
        case '기타조적구조':
            structureScore += 7;
            break;
        case '일반목구조':
        case '흙벽돌조':
            structureScore += 8;
            break;
        case '통나무구조':
        case '조립식판넬조':
            structureScore += 10;
            break;
        default:
            // 기타 (null)
            break;
    }
    buildingScore += structureWeight * structureScore;

    // 소방서 거리별 점수 
    var distanceScore = 0;
    var nearestFireStationDistance = Number.MAX_SAFE_INTEGER;
    var nearestFireStation;
    for (var i = 0; i < dataFireStations.length; i++) {
        var fireStation = dataFireStations[i];
        var distance = geolib.getDistance(
            { latitude: parseFloat(building["x"]), longitude: parseFloat(building["y"]) },
            { latitude: parseFloat(fireStation["위도"]), longitude: parseFloat(fireStation["경도"]) }
        );
        if (distance < nearestFireStationDistance) {
            nearestFireStationDistance = distance;
            nearestFireStation = fireStation;
        }
    }
    nearestFireStationDistance = nearestFireStationDistance / 1000;// convert to km
    console.log("가장 가까운 소방서:", nearestFireStation);
    console.log("소방서까지의 거리:", nearestFireStationDistance);


    // 소방서 거리별 점수를 추가합니다.
    if (nearestFireStationDistance < 1) distanceScore = 0;
    else if (nearestFireStationDistance < 3) distanceScore = 2;
    else if (nearestFireStationDistance < 5) distanceScore = 4;
    else if (nearestFireStationDistance < 8) distanceScore = 7;
    else distanceScore = 10;
    buildingScore += distanceWeight * distanceScore;

    return buildingScore;


} //여기까지 알고리즘.


// 화재위험지수에 따라 안전 수준을 분류하는 함수
function classifySafetyLevel(score) {
    if (score >= 0 && score <= 4) {
        return '안전';
    } else if (score > 4 && score <= 7) {
        return '보통';
    } else if (score > 7 && score <= 8) {
        return '위험';
    } else if (score > 8 && score <= 10) {
        return '매우위험';
    } else {
        return '알 수 없음';
    }
}


function processMap() {
    // 건물 데이터와 소방서 데이터를 로드합니다.
    Promise.all([loadBuildingData(), loadFireStationData()])
        .then(function () {
            // dataBuildings에서 모든 건물을 순회하며 위험한 건물과 매우 위험한 건물에 대해 마커를 생성하고 지도에 표시합니다.
            for (let i = 0; i < Math.min(450, dataBuildings.length); i++) { //테스트용으로 300개만 실행시키는 반복문 
              //   for (var i = 0; i < dataBuildings.length; i++) { //이게 모든 건물을 출력하는 반복문
                var building = dataBuildings[i];
                var buildingScore = calculateBuildingScore(building);
                var safetyLevel = classifySafetyLevel(buildingScore);

                var first_imageSrc = '../마커_빨간색.png';
                var second_imageSrc = '../마커_노란색.png';
                var third_imageSrc = '../마커_파란색.png';


                var imageSize = new kakao.maps.Size(50, 50);// 마커이미지의 크기입니다
                var imageOption = { offset: new kakao.maps.Point(27, 69) }; // 마커이미지의 옵션입니다. 마커의 좌표와 일치시킬 이미지 안에서의 좌표를 설정합니다.
                var markerImage1 = new kakao.maps.MarkerImage(first_imageSrc, imageSize, imageOption);
                var markerImage2 = new kakao.maps.MarkerImage(second_imageSrc, imageSize, imageOption);
                var markerImage3 = new kakao.maps.MarkerImage(third_imageSrc, imageSize, imageOption);

                function createMarker(safetyLevel, markerImage, building, buildingScore, map) {
                    let position = new kakao.maps.LatLng(parseFloat(building["x"]), parseFloat(building["y"]));
                    let marker = new kakao.maps.Marker({
                        position: position,
                        image: markerImage,
                        map: null
                    })

                    let infowindow = new kakao.maps.InfoWindow({
                        position: position,
                        content: "위험 점수: " + buildingScore.toFixed(2) + "<br>도로명 주소: " + building["도로명대지위치"] + "   "
                    });

                    kakao.maps.event.addListener(marker, 'click', function () {
                        if (infowindow.getMap()) {
                            infowindow.close();
                        } else {
                            infowindow.open(map, marker);
                        }
                    });

                    return marker;
                }

                let safetyLevelMapping = {
                    '매우위험': { markers: marker_danger, image: markerImage1 },
                    '위험': { markers: marker_soso, image: markerImage2 },
                    '보통': { markers: marker_safe, image: markerImage3 },
                }

                let safetyInfo = safetyLevelMapping[safetyLevel];
                if (safetyInfo) {
                    let marker = createMarker(safetyLevel, safetyInfo.image, building, buildingScore, map);
                    safetyInfo.markers.push(marker);
                }

            }
            hideLoadingOverlay();
        })
        .catch(function (error) {
            console.error('Error:', error);
        });
}


function handleClick(event) {
    const buttonId = event.target.id;
    if (buttonId == 'LV1') {
        // 버튼 1에 대한 동작 수행
        for (var i = 0; i < marker_danger.length; i++) {
            if (marker_danger[i].getMap()) {
                marker_danger[i].setMap(null);
            }
            else {
                marker_danger[i].setMap(map);
            }
        }
    } else if (buttonId == 'LV2') {
        // 버튼 2에 대한 동작 수행
        for (var i = 0; i < marker_soso.length; i++) {
            if (marker_soso[i].getMap()) {
                marker_soso[i].setMap(null);
            }
            else {
                marker_soso[i].setMap(map);
            }
        }
    } else if (buttonId == 'LV3') {
        for (var i = 0; i < marker_safe.length; i++) {
            if (marker_safe[i].getMap()) {
                marker_safe[i].setMap(null);
            }
            else {
                marker_safe[i].setMap(map);
            }
        }
    }
}


function handleClick(event) {
    const buttonId = event.target.id;
    if (buttonId == 'LV1') {
        // 버튼 1에 대한 동작 수행
        for (var i = 0; i < marker_danger.length; i++) {
            if (marker_danger[i].getMap()) {
                marker_danger[i].setMap(null);
            }
            else {
                marker_danger[i].setMap(map);
            }
        }
    } else if (buttonId == 'LV2') {
        // 버튼 2에 대한 동작 수행
        for (var i = 0; i < marker_soso.length; i++) {
            if (marker_soso[i].getMap()) {
                marker_soso[i].setMap(null);
            }
            else {
                marker_soso[i].setMap(map);
            }
        }
    } else if (buttonId == 'LV3') {
        for (var i = 0; i < marker_safe.length; i++) {
            if (marker_safe[i].getMap()) {
                marker_safe[i].setMap(null);
            }
            else {
                marker_safe[i].setMap(map);
            }
        }
    }
}


document.addEventListener('DOMContentLoaded', function () {
    const buttons = document.querySelectorAll('.danger-button');

    buttons.forEach((button) => {
        button.addEventListener('click', function (event) {
            handleClick(event);
        });
    });
});       