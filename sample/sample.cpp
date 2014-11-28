#include <node.h>

#include <sample_config.h>

void init(v8::Handle<v8::Object> exports) {
#ifdef SAMPLE_HAVE_PRINTF
    printf("Hello world.\n");
#endif
}

NODE_MODULE(init, "sample");
