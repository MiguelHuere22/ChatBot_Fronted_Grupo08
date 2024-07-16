import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { LocalStorageService } from '../service/local-storage.service';
import { ChatbotService } from '../service/chatbot.service';
import { PipesModule } from '../pipes/pipes.module';  // Importa el módulo de Pipes
import Swal from 'sweetalert2';

@Component({
  selector: 'app-menu-estudiante',
  standalone: true,
  templateUrl: './menu-estudiante.component.html',
  styleUrls: ['./menu-estudiante.component.css'],
  imports: [CommonModule, FormsModule, PipesModule]
})
export class MenuEstudianteComponent implements OnInit, OnDestroy {
  contador: number = 0;
  id_persona: string = '';
  nombres: string = '';
  apellidoPaterno: string = '';
  apellidoMaterno: string = '';
  selectedOption: string = 'bienvenida';
  username: string = ''; // Variable para almacenar el username
  userMessage: string = '';
  conversations: any[] = [];
  selectedConversationMessages: any[] = [];
  currentConversationTitle: string | null = null;
  refreshInterval: any;
  refreshConversationsInterval: any;
  isMenuHidden: boolean = false; // Estado del menú
  selectedFile: File | null = null; // Variable para almacenar la imagen seleccionada

  constructor(
    private router: Router,
    private localStorageService: LocalStorageService,
    private chatbotService: ChatbotService
  ) {}

  ngOnInit(): void {
    if (this.contador == 0) {
      this.loadUserData();
      this.loadConversations();
      this.contador = this.contador + 1;
    }

    // Iniciar el intervalo de actualización automática de las conversaciones
    this.refreshConversationsInterval = setInterval(() => {
      this.loadConversations();
    }, 5000); // Actualizar cada 5 segundos
  }

  ngOnDestroy(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
    if (this.refreshConversationsInterval) {
      clearInterval(this.refreshConversationsInterval);
    }
  }

  loadUserData(): void {
    console.log('Llamado a loadUserData');
    const personaDataString = this.localStorageService.getItem('personaData');
    const userDataString = this.localStorageService.getItem('userData');
    if (personaDataString && userDataString) {
      try {
        const personaData = JSON.parse(personaDataString);
        const userData = JSON.parse(userDataString);
        console.log('Datos de la persona cargados:', personaData);
        if (personaData && typeof personaData === 'object' && userData && typeof userData === 'object') {
          this.nombres = personaData.nombres || '';
          this.apellidoPaterno = personaData.apellido_paterno || '';
          this.apellidoMaterno = personaData.apellido_materno || '';
          this.id_persona = personaData.id_persona || '';
          this.username = userData.username || ''; // Guardar el username
        } else {
          console.error('Parsed persona or user data is not an object:', personaData, userData);
        }
      } catch (error) {
        console.error('Error parsing persona or user data from localStorage:', error);
      }
    } else {
      console.error('No persona or user data found in localStorage');
      this.router.navigate(['/login']);
    }
  }

  loadConversations(): void {
    this.chatbotService.listConversations({ username: this.username }).subscribe(
      (response) => {
        if (response.status_code === 200) {
          this.conversations = response.data;
        } else {
          console.error('Error loading conversations:', response.msg);
        }
      },
      (error) => {
        console.error('Error loading conversations:', error);
      }
    );
  }

  selectConversation(titulo: string): void {
    if (this.currentConversationTitle !== titulo) {
      this.currentConversationTitle = titulo;
      this.selectedConversationMessages = []; // Clear previous messages
      this.refreshConversation();
      // Iniciar el intervalo de actualización automática
      if (this.refreshInterval) {
        clearInterval(this.refreshInterval);
      }
      this.refreshInterval = setInterval(() => {
        this.refreshConversation();
      }, 5000); // Actualizar cada 5 segundos
    }
  }

  startNewConversation(): void {
    this.currentConversationTitle = null;
    this.selectedConversationMessages = [];
    this.userMessage = ''; // Limpiar el campo de entrada
    this.selectOption('chatbot');
  }

  onFileSelected(event: any): void {
    this.selectedFile = event.target.files[0];
  }

  removeSelectedFile(): void {
    this.selectedFile = null;
  }

  sendMessage(): void {
    if (this.userMessage.trim() === '') return;

    const formData = new FormData();
    formData.append('username', this.username);
    formData.append('pregunta', this.userMessage);
    formData.append('titulo', this.currentConversationTitle || '');
    if (this.selectedFile) {
      formData.append('image', this.selectedFile);
    }

    const apiCall = this.currentConversationTitle
      ? this.chatbotService.continueConversation(formData)
      : this.chatbotService.startConversation(formData);

    this.userMessage = ''; // Limpiar el campo de entrada
    this.selectedFile = null; // Limpiar el campo de selección de archivo

    apiCall.subscribe(
      (response) => {
        if (response.status_code === 200) {
          if (!this.currentConversationTitle) {
            this.currentConversationTitle = response.titulo;
            this.conversations.push({ titulo: response.titulo });
          }
          // Redirigir automáticamente a la nueva conversación
          this.selectConversation(this.currentConversationTitle as string);
        } else {
          console.error('Error sending message:', response.msg);
        }
      },
      (error) => {
        console.error('Error sending message:', error);
      }
    );
  }

  refreshConversation(): void {
    if (this.currentConversationTitle) {
      this.chatbotService.getConversation(this.username, this.currentConversationTitle).subscribe(
        (response) => {
          if (response.status_code === 200) {
            this.selectedConversationMessages = response.data.messages;
          } else {
            console.error('Error refreshing conversation:', response.msg);
          }
        },
        (error) => {
          console.error('Error refreshing conversation:', error);
        }
      );
    }
  }

  confirmDeleteConversation(titulo: string): void {
    Swal.fire({
      title: '¿Estás seguro?',
      text: `¿Quieres eliminar la conversación con el título: "${titulo}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.deleteConversation(titulo);
      }
    });
  }

  deleteConversation(titulo: string): void {
    this.chatbotService.deleteConversation(this.username, titulo).subscribe(
      (response) => {
        if (response.status_code === 200) {
          this.conversations = this.conversations.filter(conversation => conversation.titulo !== titulo);
          if (this.currentConversationTitle === titulo) {
            this.currentConversationTitle = null;
            this.selectedConversationMessages = [];
            if (this.refreshInterval) {
              clearInterval(this.refreshInterval);
            }
          }
          // Mostrar mensaje de confirmación
          Swal.fire({
            title: '¡Eliminado!',
            text: 'La conversación ha sido eliminada.',
            icon: 'success',
            confirmButtonText: 'OK'
          }).then(() => {
            // Actualizar la lista de conversaciones después de 2 segundos
            setTimeout(() => {
              this.loadConversations();
            }, 2000);
          });
        } else {
          console.error('Error deleting conversation:', response.msg);
        }
      },
      (error) => {
        console.error('Error deleting conversation:', error);
      }
    );
  }

  selectOption(option: string): void {
    this.selectedOption = option;
  }

  logout(): void {
    this.localStorageService.clear();
    this.router.navigate(['/login']);
  }

  toggleMenu(): void {
    this.isMenuHidden = !this.isMenuHidden;
  }
}
