#include <sys/socket.h>
#include <errno.h>
#include <stdio.h>
#include <unistd.h>
int main(void) { int fd=socket(40,SOCK_STREAM,0); if(fd>=0){close(fd);puts("VSOCK_ALLOWED");return 1;} printf("VSOCK_DENIED:%d\n",errno); return 0; }
