{{PROJECT_HEADER}}

set(QT_VERSION {{QT_MAJOR_VERSION}})
set(CMAKE_AUTOUIC ON)
set(CMAKE_AUTOMOC ON)
set(CMAKE_AUTORCC ON)
find_package(Qt${QT_VERSION} REQUIRED COMPONENTS Core Gui Widgets)

add_library(${PROJECT_NAME} {{LIB_TYPE}}
    {{PROJECT_NAME}}_global.h
    {{PROJECT_NAME}}.cpp
    {{PROJECT_NAME}}.h
    {{PROJECT_NAME}}.ui
)
target_link_libraries(${PROJECT_NAME} PRIVATE
    Qt${QT_VERSION}::Core
    Qt${QT_VERSION}::Gui
    Qt${QT_VERSION}::Widgets
)
target_compile_definitions(${PROJECT_NAME} PRIVATE {{EXPORT_MACRO}})
