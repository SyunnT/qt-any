{{PROJECT_HEADER}}

set(QT_VERSION {{QT_MAJOR_VERSION}})
set(CMAKE_AUTOMOC ON)
find_package(Qt${QT_VERSION} REQUIRED COMPONENTS Core)

add_executable(${PROJECT_NAME}
    main.cpp
    {{PROJECT_NAME}}.cpp
    {{PROJECT_NAME}}.h
)
target_link_libraries(${PROJECT_NAME} PRIVATE
    Qt${QT_VERSION}::Core
)
