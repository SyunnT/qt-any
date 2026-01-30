{{PROJECT_HEADER}}

add_library(${PROJECT_NAME} {{LIB_TYPE}}
    {{PROJECT_NAME}}_global.h
    {{PROJECT_NAME}}.c
    {{PROJECT_NAME}}.h
)
target_compile_definitions(${PROJECT_NAME} PRIVATE {{EXPORT_MACRO}})
