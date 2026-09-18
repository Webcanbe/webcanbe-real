#include <sys/socket.h>
#include <errno.h>
#include <stdio.h>
#include <unistd.h>
#include <sys/wait.h>
#include <signal.h>
#include <string.h>
/* Fixed synthetic probe only: at most 256 sleeping children, each reaped.
 * Invoked by the trusted proof mode inside the existing TasksMax=192 job. */
static int task_probe(void) {
  pid_t children[256]; int count=0, failure=0;
  for (;count<256;count++) {
    pid_t child=fork();
    if(child<0){failure=errno;break;}
    if(child==0){for(;;)pause();}
    children[count]=child;
  }
  for(int i=0;i<count;i++)kill(children[i],SIGKILL);
  int reaped=0;
  for(int i=0;i<count;i++){pid_t waited;do{waited=waitpid(children[i],NULL,0);}while(waited<0&&errno==EINTR);if(waited==children[i])reaped++;}
  printf("{\"spawned\":%d,\"limitDenied\":%s,\"childrenReaped\":%s}\n",count,failure==EAGAIN?"true":"false",reaped==count?"true":"false");
  return count>0&&count<192&&failure==EAGAIN&&reaped==count?0:1;
}
int main(int argc,char **argv) { if(argc==2&&strcmp(argv[1],"tasks")==0)return task_probe(); int fd=socket(40,SOCK_STREAM,0); if(fd>=0){close(fd);puts("VSOCK_ALLOWED");return 1;} printf("VSOCK_DENIED:%d\n",errno); return 0; }
